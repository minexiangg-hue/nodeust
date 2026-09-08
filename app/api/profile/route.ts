import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { apiError, readJsonObject } from '@/lib/api-response';
import { requireMember } from '@/lib/current-member';
import { buildProfileUpdate } from '@/lib/profile-update';

export async function GET() {
  try {
    const member = await requireMember();
    return NextResponse.json({ profile: member });
  } catch (error) {
    return apiError(error, '无法读取个人资料。');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const member = await requireMember();
    const result = buildProfileUpdate(await readJsonObject(request));
    if (result.error !== undefined)
      return NextResponse.json({ error: result.error }, { status: 422 });
    const update = { ...result.update, updatedAt: new Date() };
    await getDb().update(users).set(update).where(eq(users.id, member.id));
    return NextResponse.json({ status: 'saved' });
  } catch (error) {
    return apiError(error, '个人资料保存失败。');
  }
}
