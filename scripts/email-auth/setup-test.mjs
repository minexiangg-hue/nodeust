import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
const path = '/tmp/nodeust-email-auth-test.env';
assert.ok(
  !existsSync(path),
  'Existing test environment must be reused, not overwritten',
);
const suffix = randomBytes(4).toString('hex'),
  schema = `nodeust_email_test_${suffix}`,
  user = `nodeemail_${suffix}`,
  password = randomBytes(32).toString('hex');
const sql = `CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON \`${schema}\`.* TO '${user}'@'127.0.0.1';`;
const admin = spawnSync(
  'sudo',
  ['-n', 'mysql', '--batch', '--skip-column-names'],
  { input: sql, encoding: 'utf8' },
);
assert.equal(admin.status, 0, 'Restricted test database setup failed');
const url = `mysql://${user}:${password}@127.0.0.1:3306/${schema}`;
const env = [
  `NODE_EMAIL_DATABASE_URL=${url}`,
  'DATABASE_URL=mysql://unusable_legacy:invalid@127.0.0.1:1/nodeust_legacy_sentinel',
  'NODE_AUTH_MODE=email',
  'NODE_EMAIL_ORIGIN=http://127.0.0.1:3104',
  'NODE_EMAIL_TEST_MODE=true',
  'NODE_EMAIL_MAIL_TRANSPORT=file',
  `NODE_EMAIL_TEST_OUTBOX=/tmp/nodeust-email-outbox-${suffix}`,
  `NODE_EMAIL_RATE_SECRET=${randomBytes(32).toString('hex')}`,
  'NODE_EMAIL_OWNER_EMAIL=owner@connect.ust.hk',
  'NODE_ENV=production',
  'PORT=3104',
  'HOSTNAME=127.0.0.1',
  'DB_POOL_SIZE=5',
  'NODE_MAINTENANCE_MODE=false',
  `NODE_TRUSTED_PROXY_SECRET=${randomBytes(32).toString('hex')}`,
  '',
];
writeFileSync(path, env.join('\n'), { mode: 0o600, flag: 'wx' });
const db = await mysql.createConnection({
  uri: url,
  timezone: 'Z',
  multipleStatements: true,
});
try {
  const [visible] = await db.query('SHOW DATABASES');
  assert.ok(
    visible.every((r) =>
      [schema, 'information_schema', 'performance_schema'].includes(r.Database),
    ),
  );
  await migrate(drizzle(db), { migrationsFolder: 'drizzle-mysql' });
  await db.query(readFileSync('db/email-auth.sql', 'utf8'));
  console.log(
    JSON.stringify({
      schema,
      envFile: path,
      restricted: true,
      legacyDatabaseUnreachable: true,
    }),
  );
} finally {
  await db.end();
}
