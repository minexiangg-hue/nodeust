import { and, desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { feedback, users } from '@/db/schema';
import { requireMember } from '@/lib/current-member';
import { apiError, readJsonObject } from '@/lib/api-response';
import { PAGE_SIZE, pageOffset, pagedItems } from '@/lib/pagination';

const categories = new Set(['bug', 'suggestion', 'other']);
const FEEDBACK_BODY_MAX = 2000;

// Member-submitted feedback for the Owner. Deliberately NOT run through
// validatePublicContent: testers may legitimately include contact details
// (which the phone detector would flag as spam).

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = await readJsonObject(request);
    const category = typeof input.category === 'string' ? input.category : '';
    const body =
      typeof input.body === 'string'
        ? input.body.trim().slice(0, FEEDBACK_BODY_MAX)
        : '';
    if (!categories.has(category))
      return NextResponse.json(
        { error: 'Invalid feedback category.' },
        { status: 400 },
      );
    if (!body)
      return NextResponse.json(
        { error: 'Feedback body is required.' },
        { status: 422 },
      );

    const id = crypto.randomUUID();
    const now = new Date();
    await getDb()
      .insert(feedback)
      .values({
        id,
        authorId: member.id,
        category: category as (typeof feedback.category.enumValues)[number],
        body,
        status: 'open',
        createdAt: now,
      });
    return NextResponse.json({ id, status: 'open' }, { status: 201 });
  } catch (error) {
    return apiError(error, 'Unable to process feedback.');
  }
}

export async function GET(request: NextRequest) {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const status = request.nextUrl.searchParams.get('status');
    const rows = await getDb()
      .select({
        id: feedback.id,
        category: feedback.category,
        body: feedback.body,
        status: feedback.status,
        createdAt: feedback.createdAt,
        resolvedAt: feedback.resolvedAt,
        username: users.identityId,
        alias: users.anonymousAlias,
      })
      .from(feedback)
      .innerJoin(users, eq(feedback.authorId, users.id))
      .where(
        status === 'open' || status === 'resolved'
          ? eq(feedback.status, status)
          : undefined,
      )
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(PAGE_SIZE + 1)
      .offset(pageOffset(request.nextUrl.searchParams));
    return NextResponse.json(pagedItems(rows));
  } catch (error) {
    return apiError(error, 'Unable to load feedback.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const input = await readJsonObject(request);
    const action =
      input.action === 'reopen'
        ? 'reopen'
        : input.action === 'resolve'
          ? 'resolve'
          : null;
    if (typeof input.id !== 'string' || !action)
      return NextResponse.json(
        { error: 'Missing id or action.' },
        { status: 400 },
      );

    const now = new Date();
    const values =
      action === 'resolve'
        ? {
            status: 'resolved' as const,
            resolvedAt: now,
            resolvedById: member.id,
          }
        : {
            status: 'open' as const,
            resolvedAt: null,
            resolvedById: null,
          };
    const [result] = await getDb()
      .update(feedback)
      .set(values)
      .where(
        and(
          eq(feedback.id, input.id),
          eq(feedback.status, action === 'resolve' ? 'open' : 'resolved'),
        ),
      );
    if (!result.affectedRows)
      return NextResponse.json(
        {
          error:
            'Feedback was deleted or its status changed. Refresh the list.',
        },
        { status: 409 },
      );
    return NextResponse.json({ id: input.id, status: values.status });
  } catch (error) {
    return apiError(error, 'Unable to update feedback.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const input = await readJsonObject(request);
    if (typeof input.id !== 'string' || !input.id)
      return NextResponse.json(
        { error: 'A feedback id is required.' },
        { status: 400 },
      );
    // The status predicate is part of the write: a concurrent reopen prevents deletion.
    const [result] = await getDb()
      .delete(feedback)
      .where(and(eq(feedback.id, input.id), eq(feedback.status, 'resolved')));
    if (!result.affectedRows)
      return NextResponse.json(
        {
          error:
            'Resolve the feedback before deleting it, or refresh the list.',
        },
        { status: 409 },
      );
    return NextResponse.json({ id: input.id, status: 'deleted' });
  } catch (error) {
    return apiError(error, 'Unable to delete feedback.');
  }
}
