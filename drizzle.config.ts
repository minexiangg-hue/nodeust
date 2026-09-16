import { defineConfig } from 'drizzle-kit';
import { emailMode, emailDatabaseUrl } from './lib/email-auth/config';

export default defineConfig({
  out: './drizzle-mysql',
  schema: './db/schema.ts',
  dialect: 'mysql',
  dbCredentials: {
    url:
      emailMode() ? emailDatabaseUrl() : (process.env.DATABASE_URL ??
      'mysql://nodeust:change-me@127.0.0.1:3306/nodeust'),
  },
});
