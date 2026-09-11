import { and, desc, eq, like, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { posts, users } from '@/db/schema';
import { parsePostInput } from '@/lib/post-input';
import { requireMember } from '@/lib/current-member';
import { campusLocationIds } from '@/lib/campus-locations';
import { PAGE_SIZE, pageOffset, pagedItems } from '@/lib/pagination';

const categories = new Set(['hall', 'goods', 'study', 'transport', 'other']);

export async function GET(request: NextRequest) {
  try {
    const member = await requireMember();
    const category = request.nextUrl.searchParams.get('category');
    const location = request.nextUrl.searchParams.get('location');
    const query = request.nextUrl.searchParams.get('q');
    const mine = request.nextUrl.searchParams.get('mine') === '1';
    const conditions = [
      mine ? eq(posts.ownerId, member.id) : eq(posts.status, 'active'),
    ];
    const status = request.nextUrl.searchParams.get('status');
    if (
      mine &&
      (status === 'active' ||
        status === 'closed' ||
        status === 'matched' ||
        status === 'removed')
    )
      conditions.push(eq(posts.status, status));
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
        status: posts.status,
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
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(mine ? PAGE_SIZE + 1 : 100)
      .offset(mine ? pageOffset(request.nextUrl.searchParams) : 0);
    const safeItems = items.map(({ ownerId, ...item }) => ({
      ...item,
      isMine: ownerId === member.id,
    }));
    return NextResponse.json(
      mine ? pagedItems(safeItems) : { items: safeItems },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = (await request.json()) as Record<string, unknown>;
    const values = parsePostInput(input);

    const id = crypto.randomUUID();
    const now = new Date();
    await getDb()
      .insert(posts)
      .values({
        id,
        ownerId: member.id,
        ...values,
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
  if (message.startsWith('INVALID_POST:'))
    return NextResponse.json({ error: message.slice(13) }, { status: 422 });
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
