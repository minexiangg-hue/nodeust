import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users } from '@/db/schema';
import { campusLocationIds } from '@/lib/campus-locations';
import { requireMember } from '@/lib/current-member';

export async function PATCH(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = (await request.json()) as Record<string, unknown>;
    const locationId =
      typeof input.locationId === 'string' ? input.locationId : '';
    if (!campusLocationIds.has(locationId))
      return NextResponse.json(
        { error: '请选择一个有效的校园地点。' },
        { status: 422 },
      );

    const now = new Date();
    await getDb()
      .update(users)
      .set({
        currentLocationId: locationId,
        locationUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, member.id));
    return NextResponse.json({ status: 'saved', locationId, updatedAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json(
      {
        error: message === 'UNAUTHENTICATED' ? '请先登录。' : '地点更新失败。',
      },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 },
    );
  }
}
