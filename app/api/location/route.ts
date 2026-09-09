import { eq, count } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { users, posts } from '@/db/schema';
import { campusLocationIds, campusLocations } from '@/lib/campus-locations';
import { requireMember } from '@/lib/current-member';
import { apiError } from '@/lib/api-response';

// Aggregate only: no identities or individual location tags are exposed.
export async function GET() {
  try {
    await requireMember();
    const [people, requests] = await Promise.all([
      getDb()
        .select({ locationId: users.currentLocationId, count: count() })
        .from(users)
        .where(eq(users.status, 'active'))
        .groupBy(users.currentLocationId),
      getDb()
        .select({ locationId: posts.locationId, count: count() })
        .from(posts)
        .where(eq(posts.status, 'active'))
        .groupBy(posts.locationId),
    ]);
    return NextResponse.json({
      items: campusLocations.map((location) => ({
        locationId: location.id,
        peopleCount: Number(
          people.find((item) => item.locationId === location.id)?.count ?? 0,
        ),
        requestCount: Number(
          requests.find((item) => item.locationId === location.id)?.count ?? 0,
        ),
      })),
    });
  } catch (error) {
    return apiError(error, 'Unable to load location counts.');
  }
}

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
