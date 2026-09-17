import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authConfig, AuthError } from './config.ts';
import { authMailContent } from './template.ts';
export async function sendAuthMail(
  email: string,
  purpose: 'verify' | 'reset',
  token: string,
) {
  const config = authConfig();
  const path = purpose === 'verify' ? '/verify-email' : '/reset-password';
  const link = `${config.origin}${path}#token=${encodeURIComponent(token)}`;
  const message = {
    from: process.env.NODE_EMAIL_FROM,
    to: email,
    ...authMailContent(purpose, link),
  };
  if (process.env.NODE_EMAIL_MAIL_TRANSPORT === 'file') {
    const directory = process.env.NODE_EMAIL_TEST_OUTBOX || '';
    if (
      !config.test ||
      !/^\/tmp\/nodeust-email-[a-zA-Z0-9_-]+$/.test(directory)
    )
      throw new Error('Unsafe test mail configuration');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      `${directory}/${randomUUID()}.json`,
      JSON.stringify(message),
      { mode: 0o600, flag: 'wx' },
    );
    return;
  }
  const host = process.env.NODE_EMAIL_SMTP_HOST,
    user = process.env.NODE_EMAIL_SMTP_USER,
    pass = process.env.NODE_EMAIL_SMTP_PASSWORD;
  const port = Number(process.env.NODE_EMAIL_SMTP_PORT || 587);
  if (!host || !user || !pass || !message.from || ![465, 587].includes(port))
    throw new AuthError('MAIL_UNAVAILABLE', 503);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    await transport.sendMail(message);
  } catch {
    throw new AuthError('MAIL_UNAVAILABLE', 503);
  } finally {
    transport.close();
  }
}
