import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';

export type AppUser = {
  identityId: string;
  email: string;
  affiliation: 'student' | 'staff' | 'faculty';
  fullName: string;
  role: 'member' | 'moderator' | 'admin' | 'owner';
};

const HKUST_EMAIL = /@(connect\.)?ust\.hk$/i;

export async function getCurrentUser(): Promise<AppUser | null> {
  const requestHeaders = await headers();
  const identityId = requestHeaders.get('x-hkust-uid');
  const email = requestHeaders.get('x-hkust-email');
  const affiliation = requestHeaders.get('x-hkust-affiliation');
  const trustedIdentitySource =
    process.env.NODE_ENV === 'development' || isTrustedProxy(requestHeaders);

  if (trustedIdentitySource && identityId && email && HKUST_EMAIL.test(email)) {
    return {
      identityId,
      email,
      affiliation: normalizeAffiliation(affiliation),
      fullName: requestHeaders.get('x-hkust-full-name') ?? email.split('@')[0],
      role: requestHeaders.get('x-node-role') === 'owner' ? 'owner' : 'member',
    };
  }

  if (process.env.NODE_ENV === 'development') {
    return {
      identityId: 'local-demo-owner',
      email: 'demo@connect.ust.hk',
      affiliation: 'student',
      fullName: 'Local Demo Owner',
      role: 'owner',
    };
  }

  return null;
}

function isTrustedProxy(requestHeaders: Headers) {
  const expected = process.env.NODE_TRUSTED_PROXY_SECRET;
  const received = requestHeaders.get('x-node-proxy-secret');
  if (!expected || !received) return false;

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export async function requireCurrentUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export function canModerate(user: AppUser): boolean {
  return (
    user.role === 'owner' || user.role === 'admin' || user.role === 'moderator'
  );
}

function normalizeAffiliation(value: string | null): AppUser['affiliation'] {
  if (value?.toLowerCase().includes('faculty')) return 'faculty';
  if (value?.toLowerCase().includes('staff')) return 'staff';
  return 'student';
}
