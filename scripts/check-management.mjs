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
    select: (selection) => query('select', undefined, selection),
    update: (table) => query('update', table),
    delete: (table) => query('delete', table),
    insert: (table) => query('insert', table),
    transaction: async (callback) => callback(db),
  };
  function query(kind, table, selection) {
    const call = {
      kind,
      table: table ? getTableName(table) : undefined,
      selection,
    };
    const chain = {
      from(value) {
        call.table = getTableName(value);
        return chain;
      },
      innerJoin(value, condition) {
        (call.joins ??= []).push({
          kind: 'inner',
          table: getTableName(value),
          condition: dialect.sqlToQuery(condition),
        });
        return chain;
      },
      leftJoin(value, condition) {
        (call.joins ??= []).push({
          kind: 'left',
          table: getTableName(value),
          condition: dialect.sqlToQuery(condition),
        });
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
      groupBy() {
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
          kind === 'select'
            ? typeof selectRows === 'function'
              ? selectRows(call)
              : selectRows
            : [{ affectedRows }],
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

test('hidden account statistics reject every non-Owner before aggregate queries', async () => {
  for (const role of [null, 'member', 'moderator', 'admin']) {
    const h = harness(role);
    await assert.rejects(h.load('lib/account-stats.ts').getAccountStats(), {
      message: role ? 'FORBIDDEN' : 'UNAUTHENTICATED',
    });
    assert.equal(h.calls.length, 0);
  }
});

test('statistics use Hong Kong calendar boundaries across UTC midnight and leap days', () => {
  const { accountStatsWindow } = harness().load('lib/account-stats.ts');
  const before = accountStatsWindow(new Date('2026-09-09T15:59:59Z'));
  const after = accountStatsWindow(new Date('2026-09-09T16:00:00Z'));
  assert.equal(before.today.toISOString(), '2026-09-08T16:00:00.000Z');
  assert.equal(after.today.toISOString(), '2026-09-09T16:00:00.000Z');
  assert.equal(after.week.toISOString(), '2026-09-03T16:00:00.000Z');
  assert.equal(after.days.length, 30);
  assert.equal(after.days[0], '2026-08-12');
  assert.equal(after.days.at(-1), '2026-09-10');
  const leap = accountStatsWindow(new Date('2024-02-29T16:00:00Z'));
  assert.equal(leap.days.at(-2), '2024-02-29');
  assert.equal(leap.days.at(-1), '2024-03-01');
});

test('Owner statistics only read users and fill zero-registration days', async () => {
  const h = harness('owner', 1, [{ day: '2026-09-09', count: 2 }]);
  const stats = await h
    .load('lib/account-stats.ts')
    .getAccountStats(new Date('2026-09-09T10:00:00Z'));
  assert.equal(stats.daily.length, 30);
  assert.deepEqual(stats.daily.at(-1), { day: '2026-09-09', count: 2 });
  assert.deepEqual(stats.daily.at(-2), { day: '2026-09-08', count: 0 });
  assert.deepEqual(
    h.calls.map((call) => [call.kind, call.table]),
    [
      ['select', 'users'],
      ['select', 'users'],
    ],
  );
  const params = h.calls[1].condition.params;
  assert.ok(params.includes('local-demo-owner'));
  assert.ok(params.includes('node-smoke-%'));
  assert.ok(h.calls[1].condition.sql.includes('not'));
});

const validPost = {
  action: 'edit',
  category: 'goods',
  title: 'Desk lamp',
  body: 'Available for pickup on campus.',
  locationId: 'academic-building',
};

test('editing is atomic, author-only, and cannot restore removed or matched posts', async () => {
  const h = harness('member');
  const response = await h.load('app/api/posts/[id]/route.ts').PATCH(
    request('PATCH', {
      ...validPost,
      ownerId: 'attacker',
      status: 'active',
      replyCount: 999,
    }),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0].condition.params, [
    'post-1',
    'member-a',
    'active',
    'closed',
  ]);
  assert.equal(h.calls[0].values.title, validPost.title);
  for (const key of ['id', 'ownerId', 'status', 'replyCount', 'createdAt'])
    assert.equal(h.calls[0].values[key], undefined);
  const stale = harness('member', 0);
  assert.equal(
    (
      await stale
        .load('app/api/posts/[id]/route.ts')
        .PATCH(request('PATCH', validPost), context)
    ).status,
    409,
  );
});

test('create and edit share validation, including contact privacy and hall field types', async () => {
  for (const input of [
    { ...validPost, title: '' },
    { ...validPost, body: 'Contact 91234567' },
    { ...validPost, category: 'hall', currentHall: {}, targetHall: 'Hall I' },
    { ...validPost, currentHall: 'x'.repeat(81) },
    { ...validPost, locationId: 'unknown' },
  ]) {
    for (const edit of [false, true]) {
      const h = harness('member');
      const route = h.load(
        edit ? 'app/api/posts/[id]/route.ts' : 'app/api/posts/route.ts',
      );
      const response = edit
        ? await route.PATCH(request('PATCH', input), context)
        : await route.POST(request('POST', input));
      assert.equal(response.status, 422);
      assert.equal(h.calls.length, 0);
    }
  }
});

test('read acknowledgement verifies participation and the message conversation before writing', async () => {
  const denied = harness('member');
  assert.equal(
    (
      await denied
        .load('app/api/conversations/[id]/messages/route.ts')
        .PATCH(request('PATCH', { messageId: 'message-1' }), context)
    ).status,
    403,
  );
  assert.equal(denied.calls.filter((call) => call.kind === 'update').length, 0);
  const now = new Date('2026-09-10T10:00:00.123Z');
  const h = harness('member', 1, (call) =>
    call.table === 'messages'
      ? [{ createdAt: now }]
      : [{ id: 'participant-1', isBlocked: false, status: 'active' }],
  );
  assert.equal(
    (
      await h.load('app/api/conversations/[id]/messages/route.ts').PATCH(
        request('PATCH', {
          messageId: 'message-1',
          lastReadAt: '2099-01-01',
        }),
        context,
      )
    ).status,
    200,
  );
  assert.deepEqual(h.calls[1].condition.params, ['post-1', 'message-1']);
  assert.deepEqual(h.calls[2].condition.params, ['post-1', 'member-a', false]);
  const update = dialect.sqlToQuery(h.calls[2].values.lastReadAt);
  assert.match(update.sql, /greatest\(coalesce/);
  assert.deepEqual(update.params, [now, now]);
  const missing = harness('member', 1, (call) =>
    call.table === 'messages' ? [] : [{ isBlocked: false, status: 'active' }],
  );
  assert.equal(
    (
      await missing
        .load('app/api/conversations/[id]/messages/route.ts')
        .PATCH(request('PATCH', { messageId: 'foreign-message' }), context)
    ).status,
    404,
  );
  assert.equal(
    missing.calls.filter((call) => call.kind === 'update').length,
    0,
  );
});

test('unread count excludes own and system messages, and uses the persisted read boundary', async () => {
  const h = harness('member');
  assert.equal(
    (await h.load('app/api/conversations/route.ts').GET()).status,
    200,
  );
  const query = dialect.sqlToQuery(h.calls[0].selection.unreadCount);
  assert.match(query.sql, /sender_id <>/);
  assert.match(query.sql, /kind <> 'system'/);
  assert.match(query.sql, /last_read_at/);
  assert.ok(query.params.includes('member-a'));
});

test('conversation deep links do not disclose metadata without authenticated membership', async () => {
  const routePath = 'app/api/conversations/[id]/route.ts';
  const chatContext = { params: Promise.resolve({ id: 'thread-1' }) };
  const anonymous = harness(null);
  const denied = await anonymous
    .load(routePath)
    .GET(request('GET'), chatContext);
  assert.equal(denied.status, 401);
  assert.deepEqual(Object.keys(await denied.json()), ['error']);
  assert.equal(anonymous.calls.length, 0);

  // An absent membership and a nonexistent conversation both produce no joined
  // row. The same generic response must hide existence and peer identity.
  for (const id of ['another-members-thread', 'missing-thread']) {
    const h = harness('member', 1, []);
    const response = await h.load(routePath).GET(request('GET'), {
      params: Promise.resolve({ id }),
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: 'Conversation unavailable.',
    });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].kind, 'select');
    assert.equal(h.calls[0].condition.params[0], id);
  }
});

test('conversation metadata query binds the caller, peer and requested unblocked thread', async () => {
  const h = harness('member', 1, []);
  await h.load('app/api/conversations/[id]/route.ts').GET(request('GET'), {
    params: Promise.resolve({ id: 'thread-1' }),
  });
  const [query] = h.calls;
  assert.equal(query.table, 'conversations');
  assert.equal(query.limit, 1);
  assert.match(query.condition.sql, /`conversations`\.`id` = \?/);
  assert.match(
    query.condition.sql,
    /`conversation_participants`\.`is_blocked` = \?/,
  );
  assert.match(query.condition.sql, /`conversations`\.`status` <> \?/);
  assert.deepEqual(query.condition.params, ['thread-1', false, 'blocked']);

  const mine = query.joins.find(
    (join) => join.table === 'conversation_participants',
  );
  assert.equal(mine.kind, 'inner');
  assert.match(
    mine.condition.sql,
    /`conversation_participants`\.`conversation_id` = `conversations`\.`id`/,
  );
  assert.match(
    mine.condition.sql,
    /`conversation_participants`\.`user_id` = \?/,
  );
  assert.deepEqual(mine.condition.params, ['member-a']);

  const peer = query.joins.find((join) => join.table === 'peer');
  assert.equal(peer.kind, 'inner');
  assert.match(
    peer.condition.sql,
    /`peer`\.`conversation_id` = `conversations`\.`id`/,
  );
  assert.match(peer.condition.sql, /`peer`\.`user_id` <> \?/);
  assert.deepEqual(peer.condition.params, ['member-a']);

  const user = query.joins.find((join) => join.table === 'users');
  assert.equal(user.kind, 'inner');
  assert.match(user.condition.sql, /`users`\.`id` = `peer`\.`user_id`/);
  const post = query.joins.find((join) => join.table === 'posts');
  assert.equal(post.kind, 'left');
  assert.match(
    post.condition.sql,
    /`posts`\.`id` = `conversations`\.`post_id`/,
  );
});

test('conversation deep links select only anonymous metadata and tolerate a missing post', async () => {
  for (const postTitle of ['A campus request', null]) {
    const row = {
      conversationId: 'thread-1',
      peerAlias: 'Sea Otter 123',
      postId: postTitle ? 'post-1' : null,
      postTitle,
    };
    const h = harness('member', 1, [row]);
    const response = await h
      .load('app/api/conversations/[id]/route.ts')
      .GET(request('GET'), { params: Promise.resolve({ id: 'thread-1' }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      session: { ...row, postTitle: postTitle ?? '' },
    });
    const [query] = h.calls;
    // Assert the actual selected columns, so a real name aliased as peerAlias
    // or an added private identity/contact column fails this privacy boundary.
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(query.selection).map(([key, column]) => [
          key,
          [getTableName(column.table), column.name],
        ]),
      ),
      {
        conversationId: ['conversations', 'id'],
        peerAlias: ['users', 'anonymous_alias'],
        postId: ['conversations', 'post_id'],
        postTitle: ['posts', 'title'],
      },
    );
    assert.equal(
      h.calls.every((call) => call.kind === 'select'),
      true,
    );
  }
});

test('location counts expose aggregates only and exclude inactive accounts and posts', async () => {
  const denied = harness(null);
  assert.equal(
    (await denied.load('app/api/location/route.ts').GET()).status,
    401,
  );
  assert.equal(denied.calls.length, 0);
  const h = harness('member', 1, [
    { locationId: 'academic-building', count: 3 },
  ]);
  const response = await h.load('app/api/location/route.ts').GET();
  const data = await response.json();
  assert.deepEqual(
    data.items.find((item) => item.locationId === 'academic-building'),
    { locationId: 'academic-building', peopleCount: 3, requestCount: 3 },
  );
  assert.equal(h.calls.length, 2);
  for (const call of h.calls) {
    assert.deepEqual(call.condition.params, ['active']);
    assert.deepEqual(Object.keys(call.selection).sort(), [
      'count',
      'locationId',
    ]);
    assert.equal(call.limit, undefined);
  }
});

test('draft parser preserves incomplete drafts and rejects corrupt entries', () => {
  const { parseDrafts } = harness().load('lib/drafts.ts');
  const draft = {
    id: 'draft-1',
    updatedAt: '2026-09-10T10:00:00Z',
    title: '',
    detail: 'Still writing',
    category: 'hall',
    from: '',
    to: '',
    locationId: 'academic-building',
  };
  assert.deepEqual(
    parseDrafts(JSON.stringify([draft, null, {}, { ...draft, title: 3 }])),
    [draft],
  );
  assert.deepEqual(parseDrafts(null), []);
  assert.throws(() => parseDrafts('{broken'));
  assert.throws(() => parseDrafts('{}'));
});
