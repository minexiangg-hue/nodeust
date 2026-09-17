import test from 'node:test';
import assert from 'node:assert/strict';
import {
  universityEmail,
  accountEmail,
  configuredOwnerEmail,
  passwordInput,
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
  safeNext,
} from '../../lib/email-auth/crypto.ts';
import { emailDatabaseUrl, authConfig } from '../../lib/email-auth/config.ts';
test('only exact university domains are accepted; normalizes case but not aliases', () => {
  assert.equal(
    universityEmail(' Student.Name@CONNECT.UST.HK '),
    'student.name@connect.ust.hk',
  );
  assert.equal(universityEmail('staff@ust.hk'), 'staff@ust.hk');
  assert.equal(universityEmail('test+tag@ust.hk'), 'test+tag@ust.hk');
  for (const email of [
    'a@ust.hk.evil.com',
    'a@connect.ust.hk.evil.com',
    'a@x.ust.hk',
    'a@ust.hk@evil.com',
    'a@uѕt.hk',
    'Name <a@ust.hk>',
    'a\n@ust.hk',
    '.a@ust.hk',
    'a..b@ust.hk',
    '@ust.hk',
    'a@gmail.com',
  ])
    assert.throws(() => universityEmail(email), email);
});
test('password length is bounded without trimming or truncation', () => {
  for (const p of ['short', 'a'.repeat(129), null])
    assert.throws(() => passwordInput(p));
  assert.equal(passwordInput('  my long password  '), '  my long password  ');
});
test('salted scrypt hashes verify correctly and no raw password is stored', async () => {
  const password = 'correct horse battery staple';
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(!a.includes(password));
  assert.ok(await verifyPassword(password, a));
  assert.equal(await verifyPassword('incorrect password', a), false);
  assert.equal(await verifyPassword(password, null), false);
});
test('tokens are random; stored digests are different from bearer secrets', () => {
  const a = newToken(),
    b = newToken();
  assert.equal(a.length, 43);
  assert.notEqual(a, b);
  assert.equal(tokenHash(a).length, 64);
  assert.notEqual(tokenHash(a), a);
});
test('return targets cannot leave the site or re-enter auth endpoints', () => {
  for (const target of [
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/api/posts',
    '/__gateway/login',
    '/login',
    '/x\n',
  ])
    assert.equal(safeNext(target), '/explore');
  assert.equal(safeNext('/matches?kind=goods'), '/matches?kind=goods');
});
test('email mode cannot reuse legacy database or database account', () => {
  const old = { ...process.env };
  try {
    process.env.DATABASE_URL = 'mysql://old:secret@127.0.0.1:3306/nodeust';
    for (const url of [
      'mysql://new:secret@127.0.0.1:3306/nodeust',
      'mysql://old:secret@127.0.0.1:3306/nodeust_email_live',
    ]) {
      process.env.NODE_EMAIL_DATABASE_URL = url;
      assert.throws(() => emailDatabaseUrl());
    }
    process.env.NODE_EMAIL_DATABASE_URL =
      'mysql://new:secret@127.0.0.1:3306/nodeust_email_test_unit';
    assert.ok(emailDatabaseUrl());
    process.env.NODE_AUTH_MODE = 'email';
    process.env.NODE_EMAIL_ORIGIN = 'http://nodeust.duckdns.org';
    process.env.NODE_EMAIL_RATE_SECRET = 'x'.repeat(32);
    delete process.env.NODE_EMAIL_TEST_MODE;
    assert.throws(() => authConfig());
    process.env.NODE_EMAIL_TEST_MODE = 'true';
    assert.throws(() => authConfig());
    process.env.NODE_EMAIL_ORIGIN = 'http://127.0.0.1:3104';
    assert.equal(authConfig().test, true);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
  }
});

test('only the exact configured owner can bypass university domain restriction', () => {
  const previous = process.env.NODE_EMAIL_OWNER_EMAIL;
  try {
    delete process.env.NODE_EMAIL_OWNER_EMAIL;
    assert.throws(() => accountEmail('admin@example.com'));
    process.env.NODE_EMAIL_OWNER_EMAIL = ' Admin@Example.com ';
    assert.equal(configuredOwnerEmail(), 'admin@example.com');
    assert.equal(accountEmail('ADMIN@example.com'), 'admin@example.com');
    assert.equal(accountEmail('student@ust.hk'), 'student@ust.hk');
    for (const value of ['other@example.com', 'admin+tag@example.com', 'admin@example.com.evil.org', 'admin@example.com@evil.org'])
      assert.throws(() => accountEmail(value));
    assert.throws(() => universityEmail('admin@example.com'));
    process.env.NODE_EMAIL_OWNER_EMAIL = 'bad@@example.com';
    assert.throws(() => configuredOwnerEmail());
  } finally {
    if (previous === undefined) delete process.env.NODE_EMAIL_OWNER_EMAIL;
    else process.env.NODE_EMAIL_OWNER_EMAIL = previous;
  }
});
