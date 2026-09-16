import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authConfig, AuthError } from './config.ts';
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
    subject:
      purpose === 'verify'
        ? 'Verify your NODE email · 验证邮箱'
        : 'Reset your NODE password · 重设密码',
    text:
      purpose === 'verify'
        ? `Complete your NODE registration using the link below, then enter the password you chose. This link expires in 24 hours and can be used once.\n\n请打开链接并输入注册时设置的密码完成验证。链接 24 小时有效，仅可使用一次。\n\n${link}\n\nIf you did not request this registration, ignore this message. 若非本人注册，请忽略。NODE is an independent campus community, not HKUST SSO.`
        : `Reset your NODE password using the link below. This link expires in 30 minutes and can be used once.\n\n链接 30 分钟有效，仅可使用一次。重设后所有已登录设备将退出。\n\n${link}\n\nIf you did not request this, ignore this message. 若非本人请求，请忽略。`,
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
