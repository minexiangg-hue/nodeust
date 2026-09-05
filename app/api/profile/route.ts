import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireMember } from '@/lib/current-member';

export async function GET() {
  try {
    const member = await requireMember();
    return NextResponse.json({ profile: member });
  } catch {
    return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = (await request.json()) as Record<string, unknown>;
    const nickname = clean(input.nickname, 50);
    const update = {
      ...(nickname ? { nickname } : {}),
      department: clean(input.department, 100),
      programme: clean(input.programme, 100),
      yearOfStudy: clean(input.yearOfStudy, 30),
      bio: clean(input.bio, 500),
      avatarSeed: clean(input.avatarSeed, 80),
      contactMethod: clean(input.contactMethod, 30),
      contactValue: clean(input.contactValue, 120),
      preferredLanguage: ['zh-CN', 'zh-HK', 'en'].includes(
        String(input.preferredLanguage),
      )
        ? String(input.preferredLanguage)
        : member.preferredLanguage,
      profileVisibility:
        input.profileVisibility === 'mutual'
          ? ('mutual' as const)
          : ('private' as const),
      updatedAt: new Date(),
    };
    await getDb().update(users).set(update).where(eq(users.id, member.id));
    return NextResponse.json({ status: 'saved' });
  } catch {
    return NextResponse.json({ error: '个人资料保存失败。' }, { status: 500 });
  }
}

function clean(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}
