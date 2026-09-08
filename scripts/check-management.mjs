// Executes the real route handlers with a stubbed DB executor. SQL is rendered
// by the real Drizzle dialect; this is NOT a replacement for a MySQL smoke test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { getTableName } from 'drizzle-orm';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nativeRequire = createRequire(import.meta.url);
const dialect = new MySqlDialect();

function harness(role = 'owner', affectedRows = 1, selectRows = []) {
  const calls = [];
  const cache = new Map();
  const db = {
    select: () => query('select'),
    update: (table) => query('update', table),
    delete: (table) => query('delete', table),
    insert: (table) => query('insert', table),
    transaction: async (callback) => callback(db),
  };
  function query(kind, table) {
    const call = { kind, table: table ? getTableName(table) : undefined };
    const chain = {
      from(value) {
        call.table = getTableName(value);
        return chain;
      },
      innerJoin() {
        return chain;
      },
      where(value) {
        if (value) call.condition = dialect.sqlToQuery(value);
        return chain;
      },
      set(value) {
        call.values = value;
        return chain;
      },
      values(value) {
        call.values = value;
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit(value) {
        call.limit = value;
        return chain;
      },
      offset(value) {
        call.offset = value;
        return chain;
      },
      // Drizzle query builders are intentionally awaitable; emulate that contract.
      // oxlint-disable-next-line unicorn/no-thenable
      then(done, failed) {
        calls.push(call);
        return Promise.resolve(
          kind === 'select' ? selectRows : [{ affectedRows }],
        ).then(done, failed);
      },
    };
    return chain;
  }
  function load(relative) {
    const path = resolve(project, relative);
    if (cache.has(path)) return cache.get(path).exports;
    const loadedModule = { exports: {} };
    cache.set(path, loadedModule);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const require = (id) => {
      if (id === '@/db') return { getDb: () => db };
      if (id === '@/lib/current-member')
        return {
          requireMember: async () => {
            if (!role) throw new Error('UNAUTHENTICATED');
            return { id: 'member-a', role };
          },
        };
      if (id === '@/lib/auth')
        return {
          canModerate: (member) =>
            ['owner', 'admin', 'moderator'].includes(member.role),
        };
      if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`);
      return nativeRequire(id);
    };
    compileFunction(code, ['require', 'module', 'exports'])(
      require,
      loadedModule,
      loadedModule.exports,
    );
    return loadedModule.exports;
  }
  return { calls, load };
}

function request(method = 'DELETE', body = { id: 'record-1' }, search = '') {
  const url = `http://localhost/api/test${search}`;
  const req = new Request(url, {
    method,
    ...(method === 'GET'
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
  });
  req.nextUrl = new URL(url);
  return req;
}
const context = { params: Promise.resolve({ id: 'post-1' }) };

test('only Owner may delete announcements, feedback and processed reports', async () => {
  for (const route of ['announcements', 'feedback', 'admin/reports']) {
    for (const role of ['member', 'moderator', 'admin']) {
      const h = harness(role);
      assert.equal(
        (await h.load(`app/api/${route}/route.ts`).DELETE(request())).status,
        403,
      );
      assert.equal(h.calls.length, 0);
    }
  }
});

test('cleanup rejects unauthenticated and malformed requests without DB writes', async () => {
  for (const route of ['announcements', 'feedback', 'admin/reports']) {
    const anonymous = harness(null);
    assert.equal(
      (await anonymous.load(`app/api/${route}/route.ts`).DELETE(request()))
        .status,
      401,
    );
    const owner = harness();
    for (const body of [null, [], {}, { id: 1 }])
      assert.equal(
        (
          await owner
            .load(`app/api/${route}/route.ts`)
            .DELETE(request('DELETE', body))
        ).status,
        400,
      );
    assert.equal(owner.calls.length, 0);
  }
});

test('announcement history is Owner-only; public endpoint retains active schedule filters', async () => {
  const member = harness('member');
  const route = member.load('app/api/announcements/route.ts');
  assert.equal(
    (await route.GET(request('GET', null, '?manage=1'))).status,
    403,
  );
  assert.equal(member.calls.length, 0);
  assert.equal((await route.GET(request('GET'))).status, 200);
  assert.ok(member.calls[0].condition.sql.includes('starts_at'));
  assert.ok(member.calls[0].condition.sql.includes('ends_at'));
  assert.ok(member.calls[0].condition.params.includes('published'));
});

test('feedback cleanup atomically requires resolved status', async () => {
  const h = harness();
  assert.equal(
    (await h.load('app/api/feedback/route.ts').DELETE(request())).status,
    200,
  );
  assert.deepEqual(h.calls[0].condition.params, ['record-1', 'resolved']);
  assert.equal(h.calls[0].table, 'feedback');
  const stale = harness('owner', 0);
  assert.equal(
    (await stale.load('app/api/feedback/route.ts').DELETE(request())).status,
    409,
  );
});

test('feedback reopen cannot succeed after concurrent deletion or resolution changes', async () => {
  const h = harness('owner', 0);
  assert.equal(
    (
      await h
        .load('app/api/feedback/route.ts')
        .PATCH(request('PATCH', { id: 'record-1', action: 'reopen' }))
    ).status,
    409,
  );
  assert.deepEqual(h.calls[0].condition.params, ['record-1', 'resolved']);
});

test('report cleanup only deletes completed reports and never touches audit logs', async () => {
  const h = harness();
  assert.equal(
    (await h.load('app/api/admin/reports/route.ts').DELETE(request())).status,
    200,
  );
  assert.deepEqual(h.calls[0].condition.params, [
    'record-1',
    'resolved',
    'dismissed',
  ]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].table, 'reports');
});

test('post deletion is a soft update constrained by owner and current status', async () => {
  const h = harness('member');
  assert.equal(
    (await h.load('app/api/posts/[id]/route.ts').DELETE(request(), context))
      .status,
    200,
  );
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].kind, 'update');
  assert.equal(h.calls[0].table, 'posts');
  assert.equal(h.calls[0].values.status, 'removed');
  assert.deepEqual(h.calls[0].condition.params, [
    'post-1',
    'member-a',
    'removed',
  ]);
  const unavailable = harness('member', 0);
  assert.equal(
    (
      await unavailable
        .load('app/api/posts/[id]/route.ts')
        .DELETE(request(), context)
    ).status,
    404,
  );
});

test('reopen only affects the current member’s closed posts, never removed posts', async () => {
  const h = harness('member', 0);
  assert.equal(
    (
      await h
        .load('app/api/posts/[id]/route.ts')
        .PATCH(request('PATCH', { action: 'reopen' }), context)
    ).status,
    409,
  );
  assert.deepEqual(h.calls[0].condition.params, [
    'post-1',
    'member-a',
    'closed',
  ]);
  assert.equal(h.calls[0].values.status, 'active');
});

test('My posts listing filters by authenticated owner and paginates independently', async () => {
  const h = harness('member');
  const response = await h
    .load('app/api/posts/route.ts')
    .GET(request('GET', null, '?mine=1&page=2'));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls[0].condition.params, ['member-a']);
  assert.equal(h.calls[0].limit, 26);
  assert.equal(h.calls[0].offset, 50);
  assert.deepEqual(await response.json(), { items: [], hasMore: false });
});

test('a stale review cannot remove content or write a duplicate moderation action', async () => {
  const h = harness('owner', 0, [
    { id: 'record-1', targetType: 'post', targetId: 'post-1' },
  ]);
  const response = await h.load('app/api/admin/reports/route.ts').PATCH(
    request('PATCH', {
      reportId: 'record-1',
      action: 'remove',
      reason: 'Community rules',
    }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(
    h.calls.map((call) => [call.kind, call.table]),
    [
      ['select', 'reports'],
      ['update', 'reports'],
    ],
  );
  assert.deepEqual(h.calls[1].condition.params, ['record-1', 'open']);
});
