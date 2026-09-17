import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { AuthError } from './config.ts';
export function normalizedEmail(input: unknown): string {
  if (typeof input !== 'string') throw new AuthError('INVALID_EMAIL');
  const email = input.trim().toLowerCase();
  const [local, domain, extra] = email.split('@');
  if (
    extra !== undefined ||
    !domain ||
    domain.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain) ||
    !local ||
    local.length > 64 ||
    !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  )
    throw new AuthError('INVALID_EMAIL');
  return email;
}
export function universityEmail(input: unknown): string {
  const email = normalizedEmail(input);
  if (!['connect.ust.hk', 'ust.hk'].includes(email.split('@')[1]))
    throw new AuthError('INVALID_EMAIL');
  return email;
}
export function configuredOwnerEmail(): string | null {
  return process.env.NODE_EMAIL_OWNER_EMAIL
    ? normalizedEmail(process.env.NODE_EMAIL_OWNER_EMAIL)
    : null;
}
export function accountEmail(input: unknown): string {
  const email = normalizedEmail(input);
  if (email === configuredOwnerEmail()) return email;
  return universityEmail(email);
}
export function passwordInput(input: unknown): string {
  if (
    typeof input !== 'string' ||
    input.length < 12 ||
    input.length > 128 ||
    Buffer.byteLength(input) > 512
  )
    throw new AuthError('INVALID_PASSWORD');
  return input;
}
let activeHashes = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeHashes >= 4) throw new AuthError('BUSY', 503);
  activeHashes++;
  try {
    return await new Promise((resolve, reject) =>
      scrypt(
        password,
        salt,
        32,
        { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    activeHashes--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(passwordInput(password), salt);
  return `scrypt$131072$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
const dummy = `scrypt$131072$8$1$${'00'.repeat(16)}$${'00'.repeat(32)}`;
export async function verifyPassword(password: string, stored?: string | null) {
  const parts = (stored || dummy).split('$');
  if (
    parts.length !== 6 ||
    parts.slice(0, 4).join('$') !== 'scrypt$131072$8$1' ||
    !/^[a-f0-9]{32}$/.test(parts[4]) ||
    !/^[a-f0-9]{64}$/.test(parts[5])
  )
    return false;
  const actual = await derive(password, Buffer.from(parts[4], 'hex'));
  return (
    timingSafeEqual(actual, Buffer.from(parts[5], 'hex')) && Boolean(stored)
  );
}
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function tokenInput(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new AuthError('INVALID_LINK');
  return value;
}
export function safeNext(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value
      .split('')
      .some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)
  )
    return '/explore';
  try {
    const url = new URL(value, 'https://node.local');
    if (
      url.origin !== 'https://node.local' ||
      /^\/(?:api|__gateway|login|register|logout|verify-email|reset-password|forgot-password)(?:\/|$)/.test(
        url.pathname,
      )
    )
      return '/explore';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/explore';
  }
}
