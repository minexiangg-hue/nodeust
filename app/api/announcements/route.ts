import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { announcements, users } from '@/db/schema';
import { validatePublicContent } from '@/lib/content-policy';
import { requireMember } from '@/lib/current-member';

const kinds = new Set(['info', 'maintenance', 'upgrade']);

export async function GET() {
  try {
    await requireMember();
    const now = new Date();
    const items = await getDb()
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        kind: announcements.kind,
        publishedAt: announcements.publishedAt,
        authorAlias: users.anonymousAlias,
      })
      .from(announcements)
      .innerJoin(users, eq(announcements.authorId, users.id))
      .where(
        and(
          eq(announcements.status, 'published'),
          or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
          or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
        ),
      )
      .orderBy(desc(announcements.publishedAt))
      .limit(20);
    return NextResponse.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    if (!['owner', 'admin', 'moderator'].includes(member.role))
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const input = (await request.json()) as Record<string, unknown>;
    const title = clean(input.title, 100);
    const body = clean(input.body, 800);
    const kind = typeof input.kind === 'string' ? input.kind : 'info';
    if (!title || !body)
      return NextResponse.json(
        { error: 'Title and message are required.' },
        { status: 422 },
      );
    if (!kinds.has(kind))
      return NextResponse.json(
        { error: 'Invalid announcement type.' },
        { status: 400 },
      );
    const policyError = validatePublicContent(title, body);
    if (policyError)
      return NextResponse.json({ error: policyError }, { status: 422 });

    const now = new Date();
    const id = crypto.randomUUID();
    await getDb()
      .insert(announcements)
      .values({
        id,
        authorId: member.id,
        title,
        body,
        kind: kind as (typeof announcements.kind.enumValues)[number],
        status: 'published',
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    return NextResponse.json({ id, status: 'published' }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function clean(value: unknown, max: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  const status = message === 'UNAUTHENTICATED' ? 401 : 500;
  return NextResponse.json(
    { error: status === 500 ? 'Unable to process the request.' : message },
    { status },
  );
}
