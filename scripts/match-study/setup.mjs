import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project=fileURLToPath(new URL('../..',import.meta.url));
const require = createRequire(new URL('../../package.json',import.meta.url));
const mysql = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');
const { migrate } = require('drizzle-orm/mysql2/migrator');
const envPath = '/tmp/nodeust-matchstudy-test.env';
const statePath = '/tmp/nodeust-matchstudy-test-state.json';
assert.ok(!existsSync(envPath) && !existsSync(statePath), 'Existing test state must be cleaned up first.');
const suffix = randomBytes(4).toString('hex');
const schema = `nodeust_matchstudy_${suffix}`;
const user = `nodematch_${suffix}`;
const password = randomBytes(32).toString('hex');
const secret = randomBytes(32).toString('hex');
const migrationsFolder = `/tmp/nodeust-matchstudy-migrations-${suffix}`;
const admin = (sql) => {
  const result = spawnSync('sudo', ['-n', 'mysql', '--batch', '--skip-column-names'], {input: sql, encoding: 'utf8'});
  assert.equal(result.status, 0, `Isolated MySQL setup failed (exit ${result.status}).`);
};
writeFileSync(statePath, JSON.stringify({schema,user,envPath,migrationsFolder,fixturesPath:'/tmp/nodeust-matchstudy-fixtures.json'},null,2), {mode:0o600});
try {
  admin(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON \`${schema}\`.* TO '${user}'@'127.0.0.1';`);
  cpSync(`${project}/drizzle-mysql`,migrationsFolder,{recursive:true,errorOnExist:true});
  const databaseUrl = `mysql://${user}:${password}@127.0.0.1:3306/${schema}`;
  writeFileSync(envPath, [
    `DATABASE_URL=${databaseUrl}`,
    `NODE_TRUSTED_PROXY_SECRET=${secret}`,
    'NODE_MAINTENANCE_MODE=false',
    'NODE_ENV=production',
    'PORT=3102',
    'HOSTNAME=127.0.0.1',
    'DB_POOL_SIZE=5',
    'NODE_TEST_BASE_URL=http://127.0.0.1:3102',
    `NODE_TEST_SCHEMA=${schema}`,
    'NODE_TEST_FIXTURES=/tmp/nodeust-matchstudy-fixtures.json',
    '',
  ].join('\n'),{mode:0o600});
  chmodSync(envPath,0o600);
  const db=await mysql.createConnection({uri:databaseUrl,timezone:'Z'});
  try {
    const [databases] = await db.query('SHOW DATABASES');
    assert.ok(databases.every(row=>[schema,'information_schema','performance_schema'].includes(row.Database)), 'Test account can see an unexpected schema.');
    await migrate(drizzle(db),{migrationsFolder});
    const entries=JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`,'utf8')).entries;
    const [history]=await db.query('SELECT COUNT(*) AS total FROM __drizzle_migrations');
    assert.equal(Number(history[0].total),entries.length);
    const [users]=await db.query('SELECT COUNT(*) AS total FROM users');
    assert.equal(Number(users[0].total),0);
    const [column]=await db.query("SELECT data_type AS kind, is_nullable AS nullable, datetime_precision AS precision_value FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='conversation_participants' AND column_name='last_read_at'");
    assert.deepEqual(column.map(row=>({...row})),[{kind:'datetime',nullable:'YES',precision_value:3}]);
    console.log(JSON.stringify({schema,envPath,migrations:entries.length,empty:true,restrictedUser:true}));
  } finally {await db.end();}
} catch(error) {
  console.error('Isolated test setup did not finish. Use scripts/match-study/cleanup.mjs after inspecting state.');
  throw new Error(error instanceof assert.AssertionError ? error.message : 'Test environment setup failed; credentials omitted.');
}
