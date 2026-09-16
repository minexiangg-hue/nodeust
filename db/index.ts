import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Pool } from 'mysql2/promise';

import * as schema from './schema';
import { emailMode, emailDatabaseUrl } from '../lib/email-auth/config';

const globalDatabase = globalThis as typeof globalThis & {
  nodeMysqlPool?: Pool;
  nodeEmailMysqlPool?: Pool;
};

function createPool() {
  const url = emailMode() ? emailDatabaseUrl() : process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'DATABASE_URL is required. Use a dedicated MySQL user and keep the URL in the server environment file.',
    );

  return mysql.createPool({
    uri: url,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: 'Z',
  });
}

export function getPool() {
  if (emailMode()) {
    emailDatabaseUrl();
    globalDatabase.nodeEmailMysqlPool ??= createPool();
    return globalDatabase.nodeEmailMysqlPool;
  }
  globalDatabase.nodeMysqlPool ??= createPool();
  return globalDatabase.nodeMysqlPool;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: 'default' });
}
