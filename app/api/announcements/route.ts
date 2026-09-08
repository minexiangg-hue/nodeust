import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { announcements, users } from '@/db/schema';
import { validatePublicContent } from '@/lib/content-policy';
import { requireMember } from '@/lib/current-member';
import { apiError, readJsonObject } from '@/lib/api-response';
import { PAGE_SIZE, pageOffset, pagedItems } from '@/lib/pagination';

const kinds = new Set(['info', 'maintenance', 'upgrade']);

export async function GET(request: NextRequest) {
  try {
    const member = await requireMember();
    const manage = request.nextUrl.searchParams.get('manage') === '1';
    if (manage && member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const now = new Date();
    const items = await getDb()
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        kind: announcements.kind,
        status: announcements.status,
        publishedAt: announcements.publishedAt,
        authorAlias: users.anonymousAlias,
      })
      .from(announcements)
      .innerJoin(users, eq(announcements.authorId, users.id))
      .where(
        manage
          ? undefined
          : and(
              eq(announcements.status, 'published'),
              or(
                isNull(announcements.startsAt),
                lte(announcements.startsAt, now),
              ),
              or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
            ),
      )
      .orderBy(desc(announcements.createdAt), desc(announcements.id))
      .limit(manage ? PAGE_SIZE + 1 : 20)
      .offset(manage ? pageOffset(request.nextUrl.searchParams) : 0);
    return NextResponse.json(manage ? pagedItems(items) : { items });
  } catch (error) {
    return apiError(error, 'Unable to load announcements.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    if (!['owner', 'admin', 'moderator'].includes(member.role))
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const input = await readJsonObject(request);
    // Title is bounded only by the DB column width (varchar 160), not by a
    // display limit. Body is `text` and intentionally has no length cap.
    const title = clean(input.title, 160);
    const body = cleanLong(input.body);
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
    // Announcements are not subject to the post length caps (title 100 /
    // body 2000) — only to the DB column limits. Title is already bounded to
    // varchar(160) above; body is TEXT (~65,535 bytes), so we keep just a
    // byte-level guard so a pathological paste can't overflow the column.
    // Content moderation (blocked patterns) still applies.
    const bodyBytes = Buffer.byteLength(body, 'utf8');
    if (bodyBytes > 60_000)
      return NextResponse.json(
        { error: 'The content is too long to store. Please shorten it.' },
        { status: 413 },
      );
    const policyError = validatePublicContent(title, body, {
      maxTitle: 160,
      maxBody: 60_000,
    });
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
    return apiError(error, 'Unable to publish the announcement.');
  }
}

function clean(value: unknown, max: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}
function cleanLong(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export async function DELETE(request: NextRequest) {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const input = await readJsonObject(request);
    if (typeof input.id !== 'string' || !input.id)
      return NextResponse.json(
        { error: 'An announcement id is required.' },
        { status: 400 },
      );
    const [result] = await getDb()
      .delete(announcements)
      .where(eq(announcements.id, input.id));
    if (!result.affectedRows)
      return NextResponse.json(
        { error: 'Announcement not found.' },
        { status: 404 },
      );
    return NextResponse.json({ id: input.id, status: 'deleted' });
  } catch (error) {
    return apiError(error, 'Unable to delete the announcement.');
  }
}
