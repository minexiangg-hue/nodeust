// Create a fresh production realm. Never migrate, truncate or import the legacy DB.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { normalizedEmail } from '../../lib/email-auth/crypto.ts';
const out = process.argv[2];
assert.ok(
  out?.startsWith('/home/ubuntu/nodeust-backups/') && !existsSync(out),
  'Provide a new protected backup-directory output file',
);
const origin = new URL(process.env.NODE_EMAIL_ORIGIN || '');
assert.equal(origin.protocol, 'https:');
const owner = normalizedEmail(process.env.NODE_EMAIL_OWNER_EMAIL);
for (const key of [
  'NODE_EMAIL_FROM',
  'NODE_EMAIL_SMTP_HOST',
  'NODE_EMAIL_SMTP_USER',
  'NODE_EMAIL_SMTP_PASSWORD',
])
  assert.ok(process.env[key], `${key} is required`);
const suffix = randomBytes(4).toString('hex'),
  schema = `nodeust_email_live_${suffix}`,
  user = `nodeemail_${suffix}`,
  password = randomBytes(32).toString('hex');
function admin(sql) {
  const r = spawnSync(
    'sudo',
    ['-n', 'mysql', '--batch', '--skip-column-names'],
    { input: sql, encoding: 'utf8' },
  );
  assert.equal(
    r.status,
    0,
    'Database provisioning failed; no credentials printed',
  );
}
admin(
  `CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON \`${schema}\`.* TO '${user}'@'127.0.0.1';`,
);
const url = `mysql://${user}:${password}@127.0.0.1:3306/${schema}`;
// Save credentials immediately so a partial setup can be recovered, not recreated blindly.
writeFileSync(
  out,
  `NODE_EMAIL_DATABASE_URL=${url}\nNODE_EMAIL_RATE_SECRET=${randomBytes(32).toString('hex')}\n`,
  { mode: 0o600, flag: 'wx' },
);
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
  const [[row]] = await db.query('SELECT COUNT(*) AS n FROM users');
  assert.equal(Number(row.n), 0);
  admin(
    `REVOKE ALL PRIVILEGES ON \`${schema}\`.* FROM '${user}'@'127.0.0.1'; GRANT SELECT,INSERT,UPDATE,DELETE ON \`${schema}\`.* TO '${user}'@'127.0.0.1';`,
  );
  console.log(
    JSON.stringify({
      schema,
      configurationFile: out,
      ownerConfigured: Boolean(owner),
      empty: true,
      legacyImported: false,
    }),
  );
} finally {
  await db.end();
}
