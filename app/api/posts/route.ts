import { and, desc, eq, like, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { posts, users } from '@/db/schema';
import { validatePublicContent } from '@/lib/content-policy';
import { requireMember } from '@/lib/current-member';
import { campusLocationIds } from '@/lib/campus-locations';

const categories = new Set(['hall', 'goods', 'study', 'other']);

export async function GET(request: NextRequest) {
  try {
    const member = await requireMember();
    const category = request.nextUrl.searchParams.get('category');
    const location = request.nextUrl.searchParams.get('location');
    const query = request.nextUrl.searchParams.get('q');
    const conditions = [eq(posts.status, 'active')];
    if (category && categories.has(category))
      conditions.push(
        eq(
          posts.category,
          category as (typeof posts.category.enumValues)[number],
        ),
      );
    if (location && campusLocationIds.has(location))
      conditions.push(eq(posts.locationId, location));
    if (query)
      conditions.push(
        or(like(posts.title, `%${query}%`), like(posts.body, `%${query}%`))!,
      );

    const items = await getDb()
      .select({
        id: posts.id,
        category: posts.category,
        title: posts.title,
        body: posts.body,
        locationId: posts.locationId,
        currentHall: posts.currentHall,
        targetHall: posts.targetHall,
        roomType: posts.roomType,
        availableFrom: posts.availableFrom,
        replyCount: posts.replyCount,
        createdAt: posts.createdAt,
        anonymousAlias: users.anonymousAlias,
        ownerId: posts.ownerId,
      })
      .from(posts)
      .innerJoin(users, eq(posts.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(100);
    return NextResponse.json({
      items: items.map(({ ownerId, ...item }) => ({
        ...item,
        isMine: ownerId === member.id,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = (await request.json()) as Record<string, unknown>;
    const category = typeof input.category === 'string' ? input.category : '';
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    const locationId =
      typeof input.locationId === 'string' ? input.locationId : '';
    if (!categories.has(category))
      return NextResponse.json({ error: '无效的需求类型。' }, { status: 400 });
    if (!campusLocationIds.has(locationId))
      return NextResponse.json(
        { error: '请选择一个有效的校园地点。' },
        { status: 422 },
      );
    const policyError = validatePublicContent(title, body);
    if (policyError)
      return NextResponse.json({ error: policyError }, { status: 422 });
    if (category === 'hall' && (!input.currentHall || !input.targetHall))
      return NextResponse.json(
        { error: '换宿需求必须填写当前及目标宿舍。' },
        { status: 422 },
      );

    const id = crypto.randomUUID();
    const now = new Date();
    await getDb()
      .insert(posts)
      .values({
        id,
        ownerId: member.id,
        category: category as (typeof posts.category.enumValues)[number],
        title,
        body,
        locationId,
        currentHall: optionalString(input.currentHall),
        targetHall: optionalString(input.targetHall),
        roomType: optionalString(input.roomType),
        genderEligibility: optionalString(input.genderEligibility),
        availableFrom: optionalString(input.availableFrom),
        createdAt: now,
        updatedAt: now,
      });
    return NextResponse.json(
      { id, status: 'active', anonymousAlias: member.anonymousAlias },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

function optionalString(value: unknown) {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || null;
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  const status =
    message === 'UNAUTHENTICATED'
      ? 401
      : message === 'BANNED' || message === 'SUSPENDED'
        ? 403
        : 500;
  return NextResponse.json(
    { error: status === 500 ? '服务器暂时无法处理请求。' : message },
    { status },
  );
}
