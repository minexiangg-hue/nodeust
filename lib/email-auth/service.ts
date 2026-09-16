import { randomUUID, createHmac } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../db/index.ts';
import { authConfig, AuthError } from './config.ts';
import {
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
  universityEmail,
} from './crypto.ts';
import { sendAuthMail } from './mail.ts';

interface Account extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string;
  user_id: string | null;
  verified_at: Date | null;
}
async function transaction<T>(run: (db: PoolConnection) => Promise<T>) {
  const db = await getPool().getConnection();
  try {
    await db.beginTransaction();
    const result = await run(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  seconds: number,
) {
  const config = authConfig(),
    window = Math.floor(Date.now() / (seconds * 1000));
  const key = createHmac('sha256', config.secret)
    .update(JSON.stringify([scope, identifier, window]))
    .digest('hex');
  const allowed = await transaction(async (db) => {
    await db.execute(
      'INSERT INTO email_rate_limits(bucket_hash,hits,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1',
      [key, new Date((window + 2) * seconds * 1000)],
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT hits FROM email_rate_limits WHERE bucket_hash=?',
      [key],
    );
    return Number(rows[0].hits) <= limit;
  });
  if (!allowed) throw new AuthError('RATE_LIMITED', 429);
}
async function token(
  db: PoolConnection,
  accountId: string,
  purpose: 'verify' | 'reset',
) {
  const value = newToken();
  await db.execute(
    'DELETE FROM email_tokens WHERE account_id=? AND purpose=?',
    [accountId, purpose],
  );
  await db.execute(
    'INSERT INTO email_tokens(token_hash,account_id,purpose,expires_at,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))',
    [
      tokenHash(value),
      accountId,
      purpose,
      new Date(Date.now() + (purpose === 'verify' ? 86400 : 1800) * 1000),
    ],
  );
  return value;
}
export async function register(email: string, password: string) {
  authConfig();
  const hash = await hashPassword(password);
  const result = await transaction(async (db) => {
    await db.execute(
      'INSERT IGNORE INTO email_accounts(id,email,password_hash,created_at,updated_at) VALUES (?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))',
      [randomUUID(), email, hash],
    );
    const [rows] = await db.execute<Account[]>(
      'SELECT * FROM email_accounts WHERE email=? FOR UPDATE',
      [email],
    );
    const account = rows[0];
    if (account.verified_at) return null;
    await db.execute(
      'UPDATE email_accounts SET password_hash=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
      [hash, account.id],
    );
    return token(db, account.id, 'verify');
  });
  if (result) await sendAuthMail(email, 'verify', result);
}
export async function requestReset(email: string) {
  authConfig();
  const result = await transaction(async (db) => {
    const [rows] = await db.execute<Account[]>(
      'SELECT * FROM email_accounts WHERE email=? FOR UPDATE',
      [email],
    );
    const a = rows[0];
    if (!a?.verified_at) return null;
    return token(db, a.id, 'reset');
  });
  if (result) await sendAuthMail(email, 'reset', result);
}
async function tokenAccount(raw: string, purpose: 'verify' | 'reset') {
  const [rows] = await getPool().execute<Account[]>(
    `SELECT a.* FROM email_accounts a JOIN email_tokens t ON t.account_id=a.id
  WHERE t.token_hash=? AND t.purpose=? AND t.expires_at>UTC_TIMESTAMP(3)`,
    [tokenHash(raw), purpose],
  );
  return rows[0];
}
export async function confirmVerification(raw: string, password: string) {
  authConfig();
  const initial = await tokenAccount(raw, 'verify');
  if (!(await verifyPassword(password, initial?.password_hash)) || !initial)
    throw new AuthError('INVALID_LINK');
  await transaction(async (db) => {
    const [accounts] = await db.execute<Account[]>(
      'SELECT * FROM email_accounts WHERE id=? FOR UPDATE',
      [initial.id],
    );
    const a = accounts[0];
    const [tokens] = await db.execute<RowDataPacket[]>(
      "SELECT token_hash FROM email_tokens WHERE token_hash=? AND account_id=? AND purpose='verify' AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
      [tokenHash(raw), initial.id],
    );
    if (
      !a ||
      a.verified_at ||
      a.password_hash !== initial.password_hash ||
      !tokens.length
    )
      throw new AuthError('INVALID_LINK');
    const userId = randomUUID(),
      alias = `Campus ${newToken().slice(0, 8)}`;
    const owner = process.env.NODE_EMAIL_OWNER_EMAIL
      ? universityEmail(process.env.NODE_EMAIL_OWNER_EMAIL)
      : null;
    await db.execute(
      `INSERT INTO users(id,identity_id,email,affiliation,full_name,nickname,anonymous_alias,role,status,created_at,updated_at)
    VALUES (?,?,?,'student',?,?,?,?,'active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
      [
        userId,
        `email:${a.id}`,
        a.email,
        '',
        '',
        alias,
        owner === a.email ? 'owner' : 'member',
      ],
    );
    await db.execute(
      'UPDATE email_accounts SET user_id=?,verified_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?',
      [userId, a.id],
    );
    await db.execute('DELETE FROM email_tokens WHERE account_id=?', [a.id]);
  });
}
export async function resetPassword(raw: string, password: string) {
  authConfig();
  const initial = await tokenAccount(raw, 'reset');
  if (!initial) throw new AuthError('INVALID_LINK');
  const hash = await hashPassword(password);
  await transaction(async (db) => {
    const [accounts] = await db.execute<Account[]>(
      'SELECT * FROM email_accounts WHERE id=? FOR UPDATE',
      [initial.id],
    );
    const [tokens] = await db.execute<RowDataPacket[]>(
      "SELECT token_hash FROM email_tokens WHERE token_hash=? AND account_id=? AND purpose='reset' AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
      [tokenHash(raw), initial.id],
    );
    if (!accounts[0]?.verified_at || !tokens.length)
      throw new AuthError('INVALID_LINK');
    await db.execute(
      'UPDATE email_accounts SET password_hash=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
      [hash, initial.id],
    );
    await db.execute('DELETE FROM email_tokens WHERE account_id=?', [
      initial.id,
    ]);
    await db.execute('DELETE FROM email_sessions WHERE account_id=?', [
      initial.id,
    ]);
  });
}
export async function login(email: string, password: string) {
  authConfig();
  const [rows] = await getPool().execute<Account[]>(
    'SELECT * FROM email_accounts WHERE email=?',
    [email],
  );
  const initial = rows[0];
  const valid = await verifyPassword(password, initial?.password_hash);
  if (!valid || !initial?.verified_at || !initial.user_id)
    throw new AuthError('LOGIN_FAILED', 401);
  return transaction(async (db) => {
    const [rows] = await db.execute<Account[]>(
      'SELECT * FROM email_accounts WHERE id=? FOR UPDATE',
      [initial.id],
    );
    const a = rows[0];
    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT status FROM users WHERE id=?',
      [initial.user_id],
    );
    if (
      !a?.verified_at ||
      a.password_hash !== initial.password_hash ||
      users[0]?.status !== 'active'
    )
      throw new AuthError('LOGIN_FAILED', 401);
    const raw = newToken();
    await db.execute(
      'DELETE FROM email_sessions WHERE account_id=? AND expires_at<=UTC_TIMESTAMP(3)',
      [a.id],
    );
    await db.execute(
      'INSERT INTO email_sessions(token_hash,account_id,expires_at,created_at) VALUES (?,?,?,UTC_TIMESTAMP(3))',
      [tokenHash(raw), a.id, new Date(Date.now() + 7 * 86400 * 1000)],
    );
    return raw;
  });
}
export async function logout(raw?: string) {
  authConfig();
  if (raw)
    await getPool().execute('DELETE FROM email_sessions WHERE token_hash=?', [
      tokenHash(raw),
    ]);
}
export async function sessionUser(raw?: string) {
  authConfig();
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT u.identity_id,u.email,u.affiliation,u.full_name,u.role
  FROM email_sessions s JOIN email_accounts a ON a.id=s.account_id JOIN users u ON u.id=a.user_id
  WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND a.verified_at IS NOT NULL AND u.status='active'`,
    [tokenHash(raw)],
  );
  const u = rows[0];
  return u
    ? {
        identityId: u.identity_id as string,
        email: u.email as string,
        affiliation: u.affiliation as 'student' | 'staff' | 'faculty',
        fullName: u.full_name as string,
        role: u.role as 'member' | 'moderator' | 'admin' | 'owner',
      }
    : null;
}
