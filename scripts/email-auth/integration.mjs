import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
const base = process.env.NODE_EMAIL_ORIGIN;
assert.equal(base, 'http://127.0.0.1:3104');
assert.equal(process.env.NODE_EMAIL_TEST_MODE, 'true');
const schema = new URL(process.env.NODE_EMAIL_DATABASE_URL).pathname.slice(1);
assert.match(schema, /^nodeust_email_test_[a-f0-9]{8}$/);
const db = await mysql.createConnection({
  uri: process.env.NODE_EMAIL_DATABASE_URL,
  timezone: 'Z',
});
const suffix = randomBytes(4).toString('hex'),
  email = `student-${suffix}@connect.ust.hk`,
  staff = `staff-${suffix}@ust.hk`,
  pw = 'Campus test password 482!',
  newPw = 'A different campus password 916!';
const results = [];
let cookie = '',
  identity = '',
  token = '';
const digest = (t) => createHash('sha256').update(t).digest('hex');
async function check(name, run) {
  await run();
  results.push(name);
  console.log('PASS ' + name);
}
async function call(action, data = {}, options = {}) {
  const r = await fetch(base + '/api/auth/' + action, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'x-real-ip': '127.0.0.20',
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
    body: options.raw ?? JSON.stringify(data),
  });
  const value = await r.json();
  return {
    status: r.status,
    value,
    cookie: r.headers.get('set-cookie')?.split(';')[0] || '',
    headers: r.headers,
  };
}
function link(address, purpose) {
  const rows = readdirSync(process.env.NODE_EMAIL_TEST_OUTBOX)
    .filter((f) => f.endsWith('.json'))
    .map((f) =>
      JSON.parse(
        readFileSync(process.env.NODE_EMAIL_TEST_OUTBOX + '/' + f, 'utf8'),
      ),
    )
    .filter(
      (m) =>
        m.to === address &&
        m.subject.startsWith(purpose === 'verify' ? 'Verify' : 'Reset'),
    );
  assert.ok(rows.length);
  return rows.map((m) =>
    new URL(m.text.match(/http:\/\/127\.0\.0\.1:3104\/[^\s]+/)[0]).hash.slice(
      '#token='.length,
    ),
  );
}
async function currentToken(address, purpose) {
  const values = link(address, purpose);
  const [rows] = await db.execute(
    'SELECT t.token_hash FROM email_tokens t JOIN email_accounts a ON a.id=t.account_id WHERE a.email=? AND t.purpose=?',
    [address, purpose],
  );
  const t = values.find((v) => digest(v) === rows[0]?.token_hash);
  assert.ok(t);
  return t;
}
async function profile(session = cookie) {
  return fetch(base + '/api/profile', { headers: { cookie: session } });
}
async function clearRates() {
  await db.query('DELETE FROM email_rate_limits');
}
try {
  await clearRates();
  await check(
    'restricted database; legacy credentials deliberately unusable',
    async () => {
      const [rows] = await db.query('SHOW DATABASES');
      assert.ok(
        rows.every((r) =>
          [schema, 'information_schema', 'performance_schema'].includes(
            r.Database,
          ),
        ),
      );
      assert.equal(new URL(process.env.DATABASE_URL).port, '1');
    },
  );
  await check(
    'forged gateway identity and old cookie cannot authenticate',
    async () => {
      const r = await fetch(base + '/api/profile', {
        headers: {
          'x-hkust-uid': 'legacy-owner',
          'x-hkust-email': 'owner@connect.ust.hk',
          'x-node-role': 'owner',
          'x-node-proxy-secret': process.env.NODE_TRUSTED_PROXY_SECRET,
          cookie: 'nodeust_preview_session=fake',
        },
      });
      assert.equal(r.status, 401);
    },
  );
  await check(
    'reject external domain, CSRF, malformed and oversized bodies',
    async () => {
      assert.equal(
        (
          await call('register', {
            email: 'attacker@ust.hk.evil.com',
            password: pw,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            'register',
            { email, password: pw },
            { headers: { origin: 'https://evil.example' } },
          )
        ).status,
        403,
      );
      assert.equal((await call('register', {}, { raw: '{' })).status, 400);
      assert.equal(
        (await call('register', {}, { raw: 'x'.repeat(9000) })).status,
        413,
      );
    },
  );
  await check(
    'registration creates only pending identity and hashed token/password',
    async () => {
      const r = await call('register', { email, password: pw });
      assert.equal(r.status, 200);
      assert.equal(r.cookie, '');
      const [rows] = await db.execute(
        'SELECT a.*,t.token_hash FROM email_accounts a JOIN email_tokens t ON t.account_id=a.id WHERE a.email=?',
        [email],
      );
      assert.equal(rows[0].verified_at, null);
      assert.equal(rows[0].user_id, null);
      assert.ok(rows[0].password_hash.startsWith('scrypt$'));
      assert.ok(!rows[0].password_hash.includes(pw));
      token = await currentToken(email, 'verify');
      assert.equal(rows[0].token_hash, digest(token));
    },
  );
  await check(
    'unverified login denied; link GET does not activate account',
    async () => {
      assert.equal((await call('login', { email, password: pw })).status, 401);
      assert.equal(
        (await fetch(base + '/verify-email#token=' + token)).status,
        200,
      );
      const [rows] = await db.execute(
        'SELECT verified_at FROM email_accounts WHERE email=?',
        [email],
      );
      assert.equal(rows[0].verified_at, null);
    },
  );
  await check(
    'verification requires password and consumes token exactly once',
    async () => {
      assert.equal(
        (await call('verify', { token, password: newPw })).status,
        400,
      );
      assert.equal((await call('verify', { token, password: pw })).status, 200);
      assert.equal((await call('verify', { token, password: pw })).status, 400);
    },
  );
  await check(
    'first normal verified account is member, never automatic owner',
    async () => {
      const [rows] = await db.execute(
        'SELECT u.role,u.identity_id FROM users u JOIN email_accounts a ON a.user_id=u.id WHERE a.email=?',
        [email],
      );
      assert.equal(rows[0].role, 'member');
      assert.match(rows[0].identity_id, /^email:/);
      identity = rows[0].identity_id;
    },
  );
  await check(
    'password login, session cookie, safe redirect and own profile',
    async () => {
      assert.equal(
        (await call('login', { email, password: newPw })).status,
        401,
      );
      const r = await call('login', {
        email: email.toUpperCase(),
        password: pw,
        next: '//evil.example',
      });
      assert.equal(r.status, 200);
      assert.equal(r.value.next, '/explore');
      assert.match(r.headers.get('set-cookie'), /HttpOnly/);
      assert.match(r.headers.get('set-cookie'), /SameSite=Lax/i);
      cookie = r.cookie;
      const p = await profile();
      assert.equal(p.status, 200);
      assert.equal((await p.json()).profile.email, email);
      const [rows] = await db.query('SELECT token_hash FROM email_sessions');
      assert.ok(rows.every((row) => !cookie.includes(row.token_hash)));
    },
  );
  await check('matching endpoint uses email session and rejects proxy identity alone', async () => {
    const forged = {'x-hkust-uid':'synthetic-forged', 'x-hkust-email':'synthetic-forged@connect.ust.hk', 'x-node-proxy-secret':process.env.NODE_TRUSTED_PROXY_SECRET};
    const denied = await fetch(base + '/api/matches', {headers:forged});
    assert.equal(denied.status,401);
    const response = await fetch(base + '/api/matches?possible=1', {headers:{...forged,cookie}});
    assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control'),/private.*no-store/);
    const matches = await response.json();
    assert.equal(matches.ownPostCount,0);
    assert.equal(matches.total,0);
    assert.deepEqual(matches.items,[]);
  });
  await check(
    'verified accounts cannot be overwritten by re-registration',
    async () => {
      assert.equal(
        (await call('register', { email, password: newPw })).status,
        200,
      );
      assert.equal(
        (await call('login', { email, password: newPw })).status,
        401,
      );
      assert.equal((await call('login', { email, password: pw })).status, 200);
    },
  );
  await check(
    'new account can create posts; cookie-auth writes enforce origin',
    async () => {
      const body = {
        category: 'other',
        title: 'Independent account test',
        body: 'Synthetic isolated auth test post',
        locationId: 'academic-building',
      };
      let r = await fetch(base + '/api/posts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
          origin: 'https://evil.example',
        },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 403);
      r = await fetch(base + '/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: base },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 201);
    },
  );
  await check('email matching paginates real candidates and revalidates edits and removal', async () => {
    const peer = crypto.randomUUID(), offerIds = Array.from({length:27},()=>crypto.randomUUID());
    let ownId;
    const ownNoiseIds=[];
    const matchConversation = crypto.randomUUID();
    try {
      await db.execute("INSERT INTO users (id,identity_id,email,affiliation,full_name,nickname,anonymous_alias,role,status,created_at,updated_at) VALUES (?,?,?,'student','Synthetic peer','Synthetic peer','Synthetic peer','member','active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[peer,peer,`match-${peer}@connect.ust.hk`]);
      for(const id of offerIds) await db.execute("INSERT INTO posts (id,owner_id,category,title,body,location_id,status,created_at,updated_at) VALUES (?,?,'goods','Monitor available','Selling a monitor for HKD 50.','academic-building','active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[id,peer]);
      const relatedId = crypto.randomUUID();
      await db.execute("INSERT INTO posts (id,owner_id,category,title,body,location_id,status,created_at,updated_at) VALUES (?,?,'goods','Monitor calibration discussion','Monitor colour calibration notes and display setup.','academic-building','active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[relatedId,peer]);
      const created = await fetch(base+'/api/posts',{method:'POST',headers:{'content-type':'application/json',cookie,origin:base},body:JSON.stringify({category:'goods',title:'Monitor wanted',body:'Looking to buy a monitor, budget HKD 100.',locationId:'academic-building'})});
      assert.equal(created.status,201);
      const [mine] = await db.execute("SELECT p.id FROM posts p JOIN users u ON u.id=p.owner_id WHERE u.identity_id=? AND p.title='Monitor wanted'",[identity]);
      assert.equal(mine.length,1); ownId=mine[0].id;
      const [[owner]] = await db.execute('SELECT owner_id FROM posts WHERE id=?',[ownId]);
      await db.execute('UPDATE posts SET created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 30 DAY) WHERE id=? OR owner_id=?',[ownId,peer]);
      for(let i=0;i<101;i++) {
        for(const user of [owner.owner_id,peer]) {
          const id=crypto.randomUUID();if(user===owner.owner_id)ownNoiseIds.push(id);
          await db.execute("INSERT INTO posts (id,owner_id,category,title,body,location_id,status,created_at,updated_at) VALUES (?,?,'other','Synthetic unrelated note','Just testing, no request.','academic-building','active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[id,user]);
        }
      }
      const page = async n => {
        const response=await fetch(base+`/api/matches?kind=goods&page=${n}`,{headers:{cookie}});
        assert.equal(response.status,200);return response.json();
      };
      const first=await page(0),second=await page(1);
      assert.equal(first.ownPostCount,103);
      assert.ok(first.relatedItems.some(item=>item.id===relatedId));
      assert.ok(!first.items.some(item=>item.id===relatedId));
      for(const item of first.relatedItems)for(const key of ['ownerId','identityId','email','fullName','contactValue','match'])assert.ok(!(key in item));

      const items=[...first.items,...second.items];
      assert.equal(first.items.length,25);assert.equal(second.items.length,2);
      assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
      assert.equal(first.total,27);assert.equal(new Set(items.map(x=>x.id)).size,27);
      assert.deepEqual(items.map(x=>x.id).sort((a,b)=>a.localeCompare(b)),[...offerIds].sort((a,b)=>a.localeCompare(b)));
      if(process.env.MATCH_EMAIL_BROWSER === '1') {
        const {checkEmailMatchBrowser}=await import('../match-evaluation/email-browser-smoke.mjs');
        await checkEmailMatchBrowser({base,cookie});
      }
      for(const item of items) {
        assert.equal(item.match.ownPostId,ownId);assert.equal(item.match.confidence,'high');
        for(const key of ['ownerId','identityId','email','fullName','contactValue'])assert.ok(!(key in item));
      }
      const hkDay = offset => new Date(Date.now()+(8+offset*24)*3600000).toISOString().slice(0,10);
      for(const [date,expected] of [[hkDay(1),27],[hkDay(-1),0]]) {
        await db.execute('UPDATE posts SET body=?,updated_at=UTC_TIMESTAMP(3) WHERE owner_id=? AND title=?',[`Selling a monitor for HKD 50. Handover at LG1 on ${date} at 12:00.`,peer,'Monitor available']);
        await db.execute('UPDATE posts SET body=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[`Looking to buy a monitor, budget HKD 100. Handover at LG1 on ${date} at 12:00.`,ownId]);
        assert.equal((await page(0)).total,expected,`Matching handover date ${date}`);
        if(expected===0) {
          const expired=await fetch(base+'/api/matches?kind=goods&possible=1',{headers:{cookie}});
          assert.equal(expired.status,200);assert.equal((await expired.json()).total,0);
        }
      }
      await db.execute("UPDATE posts SET body='Selling a monitor for HKD 50.',updated_at=UTC_TIMESTAMP(3) WHERE owner_id=? AND title='Monitor available'",[peer]);
      await db.execute("UPDATE posts SET body='Looking to buy a monitor, budget 100.',updated_at=UTC_TIMESTAMP(3) WHERE id=?",[ownId]);
      assert.equal((await page(0)).total,0);
      const uncertainResponse=await fetch(base+'/api/matches?kind=goods&possible=1',{headers:{cookie}});
      assert.equal(uncertainResponse.status,200);
      const uncertain=await uncertainResponse.json();
      assert.equal(uncertain.total,27);
      assert.ok(uncertain.items.every(item=>item.match.confidence==='possible'&&item.match.missing.includes('currency')));
      assert.ok(uncertain.needsDetails.some(post=>post.id===ownId&&post.missing.includes('currency')));
      await db.execute("UPDATE posts SET body='Looking to buy a monitor, budget HKD 100.',updated_at=UTC_TIMESTAMP(3) WHERE id=?",[ownId]);
      assert.equal((await page(0)).total,27);
      await db.execute("UPDATE posts SET body='Selling a monitor for HKD 500.',updated_at=UTC_TIMESTAMP(3) WHERE id=?",[offerIds[0]]);
      assert.equal((await page(0)).total,26);
      await db.execute("UPDATE posts SET status='removed',updated_at=UTC_TIMESTAMP(3) WHERE id=?",[offerIds[1]]);
      assert.equal((await page(0)).total,25);
      await db.execute("UPDATE users SET status='suspended' WHERE id=?",[peer]);
      assert.equal((await page(0)).total,0);
      await db.execute("UPDATE users SET status='active' WHERE id=?",[peer]);
      assert.equal((await page(0)).total,25);
      const [[me]] = await db.execute('SELECT owner_id FROM posts WHERE id=?',[ownId]);
      await db.execute("INSERT INTO conversations(id,post_id,status,created_at,updated_at) VALUES (?,?,'active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[matchConversation,ownId]);
      for(const user of [me.owner_id,peer])await db.execute('INSERT INTO conversation_participants(id,conversation_id,user_id,is_blocked,joined_at) VALUES (?,?,?,false,UTC_TIMESTAMP(3))',[crypto.randomUUID(),matchConversation,user]);
      for(const user of [me.owner_id,peer]) {
        await db.execute('UPDATE conversation_participants SET is_blocked=true WHERE conversation_id=? AND user_id=?',[matchConversation,user]);
        const blockedResult=await page(0);
        assert.equal(blockedResult.total,0);
        assert.equal(blockedResult.relatedItems.length,0);
        await db.execute('UPDATE conversation_participants SET is_blocked=false WHERE conversation_id=?',[matchConversation]);
        assert.equal((await page(0)).total,25);
      }
      await db.execute("UPDATE conversations SET status='blocked' WHERE id=?",[matchConversation]);
      assert.equal((await page(0)).total,0);

    } finally {
      await db.execute('DELETE FROM conversation_participants WHERE conversation_id=?',[matchConversation]);
      await db.execute('DELETE FROM conversations WHERE id=?',[matchConversation]);
      for(const id of ownNoiseIds)await db.execute('DELETE FROM posts WHERE id=?',[id]);
      if(ownId)await db.execute('DELETE FROM posts WHERE id=?',[ownId]);
      await db.execute('DELETE FROM posts WHERE owner_id=?',[peer]);
      await db.execute('DELETE FROM users WHERE id=?',[peer]);
    }
  });
  await check(
    'logout revokes server-side session; old cookie fails',
    async () => {
      const old = cookie;
      assert.equal((await call('logout')).status, 200);
      assert.equal((await profile(old)).status, 401);
      cookie = (await call('login', { email, password: pw })).cookie;
    },
  );
  await clearRates();
  await check(
    'unknown reset response matches real-account reset response',
    async () => {
      const unknown = await call('forgot-password', {
        email: `unknown-${suffix}@ust.hk`,
      });
      const known = await call('forgot-password', { email });
      assert.deepEqual(unknown.value, known.value);
      assert.equal(known.status, 200);
    },
  );
  await check('expired password-reset token is rejected', async () => {
    const t = await currentToken(email, 'reset');
    await db.execute(
      'UPDATE email_tokens SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE) WHERE token_hash=?',
      [digest(t)],
    );
    assert.equal(
      (await call('reset-password', { token: t, password: newPw })).status,
      400,
    );
  });
  await check(
    'password reset is one-use and revokes every old session',
    async () => {
      assert.equal((await call('forgot-password', { email })).status, 200);
      const t = await currentToken(email, 'reset'),
        old = cookie;
      const both = await Promise.all([
        call('reset-password', { token: t, password: newPw }),
        call('reset-password', { token: t, password: newPw }),
      ]);
      assert.deepEqual(
        both.map((r) => r.status).sort((a, b) => a - b),
        [200, 400],
      );
      assert.equal((await profile(old)).status, 401);
      assert.equal((await call('login', { email, password: pw })).status, 401);
      const r = await call('login', { email, password: newPw });
      assert.equal(r.status, 200);
      cookie = r.cookie;
    },
  );
  await clearRates();
  await check(
    '@ust.hk registration, newest verification link, concurrent consumption',
    async () => {
      await call('register', { email: staff, password: pw });
      const old = await currentToken(staff, 'verify');
      await call('resend', { email: staff, password: newPw });
      const fresh = await currentToken(staff, 'verify');
      assert.notEqual(old, fresh);
      assert.equal(
        (await call('verify', { token: old, password: pw })).status,
        400,
      );
      const both = await Promise.all([
        call('verify', { token: fresh, password: newPw }),
        call('verify', { token: fresh, password: newPw }),
      ]);
      assert.deepEqual(
        both.map((r) => r.status).sort((a, b) => a - b),
        [200, 400],
      );
      assert.equal(
        (await call('login', { email: staff, password: newPw })).status,
        200,
      );
    },
  );
  await check(
    'suspension invalidates existing authenticated requests',
    async () => {
      await db.execute(
        "UPDATE users SET status='suspended' WHERE identity_id=?",
        [identity],
      );
      assert.equal((await profile()).status, 401);
      assert.equal(
        (await call('login', { email, password: newPw })).status,
        401,
      );
      await db.execute("UPDATE users SET status='active' WHERE identity_id=?", [
        identity,
      ]);
    },
  );
  await check(
    'only configured verified email receives owner role',
    async () => {
      const owner = process.env.NODE_EMAIL_OWNER_EMAIL;
      const [existing] = await db.execute(
        'SELECT verified_at FROM email_accounts WHERE email=?',
        [owner],
      );
      if (!existing[0]?.verified_at) {
        assert.equal((await call('register', { email: owner, password: pw })).status, 200);
        assert.equal((await call('login', { email: owner, password: pw })).status, 401);
        const t = await currentToken(owner, 'verify');
        assert.equal(
          (await call('verify', { token: t, password: pw })).status,
          200,
        );
      }
      const [rows] = await db.execute(
        'SELECT u.role FROM users u JOIN email_accounts a ON a.user_id=u.id WHERE a.email=?',
        [owner],
      );
      assert.equal(rows[0].role, 'owner');
      assert.equal((await call('login', { email: owner, password: pw })).status, 200);
      assert.equal((await call('forgot-password', { email: owner })).status, 200);
      const reset = await currentToken(owner, 'reset');
      assert.equal((await call('reset-password', { token: reset, password: pw })).status, 200);
      assert.equal((await call('login', { email: owner, password: pw })).status, 200);
      assert.equal((await call('register', { email: `not-owner-${suffix}@example.com`, password: pw })).status, 400);

    },
  );
  await clearRates();
  await check('persistent per-address email delivery limit', async () => {
    const addr = `limited-${suffix}@ust.hk`;
    for (let i = 0; i < 3; i++)
      assert.equal(
        (await call('forgot-password', { email: addr })).status,
        200,
      );
    const r = await call('forgot-password', { email: addr });
    assert.equal(r.status, 429);
    assert.ok(r.headers.get('retry-after'));
  });
  writeFileSync(
    '/tmp/nodeust-email-integration-results.json',
    JSON.stringify(
      {
        passed: results.length,
        checks: results,
        schema,
        onlySyntheticData: true,
        externalMailSent: false,
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({ passed: results.length, externalMailSent: false }),
  );
} finally {
  await db.end();
}
