import mysql from 'mysql2/promise';
import { authConfig, emailDatabaseUrl } from '../../lib/email-auth/config.ts';
authConfig();
const db = await mysql.createConnection({
  uri: emailDatabaseUrl(),
  timezone: 'Z',
});
try {
  const counts = {};
  for (const table of ['email_tokens', 'email_sessions', 'email_rate_limits']) {
    const [r] = await db.query(
      `DELETE FROM ${table} WHERE expires_at<UTC_TIMESTAMP(3) LIMIT 10000`,
    );
    counts[table] = r.affectedRows;
  }
  const [pending] = await db.query(
    'DELETE FROM email_accounts WHERE verified_at IS NULL AND user_id IS NULL AND updated_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 30 DAY) LIMIT 1000',
  );
  counts.oldPendingAccounts = pending.affectedRows;
  console.log(JSON.stringify(counts));
} finally {
  await db.end();
}
