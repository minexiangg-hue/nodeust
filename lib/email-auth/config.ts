export class AuthError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function emailMode() {
  const mode = process.env.NODE_AUTH_MODE;
  if (mode && !['legacy', 'email'].includes(mode))
    throw new Error('Unknown authentication mode');
  return mode === 'email';
}
export function emailDatabaseUrl() {
  const raw = process.env.NODE_EMAIL_DATABASE_URL;
  if (!raw) throw new Error('Email database is not configured');
  const target = new URL(raw);
  const legacy = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL)
    : null;
  if (
    target.protocol !== 'mysql:' ||
    !/^\/nodeust_email_[a-z0-9_]+$/.test(decodeURIComponent(target.pathname)) ||
    !target.username ||
    (legacy &&
      (decodeURIComponent(target.pathname) ===
        decodeURIComponent(legacy.pathname) ||
        decodeURIComponent(target.username) ===
          decodeURIComponent(legacy.username)))
  )
    throw new Error(
      'Email authentication requires a distinct database and restricted database account',
    );
  return raw;
}
export function authConfig() {
  if (!emailMode()) throw new AuthError('AUTH_DISABLED', 404);
  const database = new URL(emailDatabaseUrl());
  const origin = new URL(process.env.NODE_EMAIL_ORIGIN || '');
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('Invalid email origin');
  const test = process.env.NODE_EMAIL_TEST_MODE === 'true';
  if (test) {
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
      !database.pathname.startsWith('/nodeust_email_test_')
    )
      throw new Error('Test mode must use a loopback origin and test database');
  } else if (origin.protocol !== 'https:')
    throw new Error('Email authentication requires HTTPS');
  if (!['http:', 'https:'].includes(origin.protocol))
    throw new Error('Invalid origin protocol');
  const secret = process.env.NODE_EMAIL_RATE_SECRET || '';
  if (secret.length < 32)
    throw new Error('Email rate-limit secret must be configured');
  return {
    origin: origin.origin,
    secure: origin.protocol === 'https:',
    test,
    secret,
    cookie:
      origin.protocol === 'https:'
        ? '__Host-nodeust_email_session'
        : 'nodeust_email_test_session',
  };
}
