import { count, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireCurrentUser, type AppUser } from '@/lib/auth';

const animals = [
  'Misty Whale',
  'Night Heron',
  'Silver Fox',
  'Sea Otter',
  'Starfish',
  'Red Squirrel',
  'Swift',
  'Clouded Leopard',
];

export async function requireMember() {
  const identity = await requireCurrentUser();
  const db = getDb();
  let [member] = await db
    .select()
    .from(users)
    .where(eq(users.identityId, identity.identityId))
    .limit(1);

  if (!member) {
    const now = new Date();
    const [{ total }] = await db.select({ total: count() }).from(users);
    const alias = `${animals[Math.floor(Math.random() * animals.length)]} ${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        identityId: identity.identityId,
        email: identity.email.toLowerCase(),
        affiliation: identity.affiliation,
        fullName: identity.fullName,
        nickname: identity.fullName,
        anonymousAlias: alias,
        preferredLanguage: 'en',
        role: preferredRole(identity, total === 0),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .onDuplicateKeyUpdate({ set: { updatedAt: now } });

    [member] = await db
      .select()
      .from(users)
      .where(eq(users.identityId, identity.identityId))
      .limit(1);
  }

  if (!member || member.status !== 'active')
    throw new Error(member?.status === 'banned' ? 'BANNED' : 'SUSPENDED');
  return member;
}

function preferredRole(identity: AppUser, isFirstMember: boolean) {
  if (identity.role === 'owner') return 'owner';
  if (isFirstMember) return 'owner';
  if (
    process.env.NODE_OWNER_EMAIL?.toLowerCase() === identity.email.toLowerCase()
  )
    return 'owner';
  return 'member';
}
