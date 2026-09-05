import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireCurrentUser, type AppUser } from '@/lib/auth';

const animals = [
  '雾鲸',
  '夜鹭',
  '银狐',
  '水獭',
  '海星',
  '松鼠',
  '雨燕',
  '云豹',
];

export async function requireMember() {
  const identity = await requireCurrentUser();
  const now = Date.now();
  const userId = crypto.randomUUID();
  const alias = `${animals[Math.floor(Math.random() * animals.length)]} ${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO users (
      id, identity_id, email, affiliation, full_name, nickname, anonymous_alias,
      preferred_language, role, status, created_at, updated_at
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, 'zh-CN',
      CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 'owner' ELSE ? END,
      'active', ?, ?
  `)
    .bind(
      userId,
      identity.identityId,
      identity.email.toLowerCase(),
      identity.affiliation,
      identity.fullName,
      identity.fullName,
      alias,
      preferredRole(identity),
      now,
      now,
    )
    .run();

  const [member] = await getDb()
    .select()
    .from(users)
    .where(eq(users.identityId, identity.identityId))
    .limit(1);
  if (!member || member.status !== 'active')
    throw new Error(member?.status === 'banned' ? 'BANNED' : 'SUSPENDED');
  return member;
}

function preferredRole(identity: AppUser) {
  if (identity.role === 'owner') return 'owner';
  if (
    process.env.NODE_OWNER_EMAIL?.toLowerCase() === identity.email.toLowerCase()
  )
    return 'owner';
  return 'member';
}
