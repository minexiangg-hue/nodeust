import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import { authConfig, emailDatabaseUrl } from '../../lib/email-auth/config.ts';
import { universityEmail } from '../../lib/email-auth/crypto.ts';
try {
  const c = authConfig();
  assert.equal(c.test, false, 'Production must not enable test mode');
  assert.equal(c.secure, true);
  universityEmail(process.env.NODE_EMAIL_OWNER_EMAIL);
  const {
    NODE_EMAIL_SMTP_HOST: host,
    NODE_EMAIL_SMTP_USER: user,
    NODE_EMAIL_SMTP_PASSWORD: pass,
    NODE_EMAIL_FROM: from,
  } = process.env;
  assert.ok(host && user && pass && from && !/[\r\n]/.test(from));
  assert.ok(
    !process.env.NODE_EMAIL_MAIL_TRANSPORT ||
      process.env.NODE_EMAIL_MAIL_TRANSPORT === 'smtp',
  );
  const port = Number(process.env.NODE_EMAIL_SMTP_PORT || 587);
  assert.ok([465, 587].includes(port));
  const u = new URL(emailDatabaseUrl()),
    db = await mysql.createConnection({ uri: u.toString(), timezone: 'Z' });
  try {
    const [visible] = await db.query('SHOW DATABASES');
    assert.ok(
      visible.every((r) =>
        [
          u.pathname.slice(1),
          'information_schema',
          'performance_schema',
        ].includes(r.Database),
      ),
    );
    for (const table of [
      'users',
      'posts',
      'email_accounts',
      'email_tokens',
      'email_sessions',
      'email_rate_limits',
    ])
      await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
  } finally {
    await db.end();
  }
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
  console.log(
    JSON.stringify({
      productionConfig: true,
      databaseIsolated: true,
      smtpConnection: true,
      mailSent: false,
    }),
  );
} catch {
  console.error(
    'Email authentication preflight failed. Check protected configuration, TLS, isolated DB and SMTP connectivity; no credentials were printed.',
  );
  process.exitCode = 1;
}
