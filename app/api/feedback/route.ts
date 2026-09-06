import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { feedback, users } from '@/db/schema';
import { requireMember } from '@/lib/current-member';

const categories = new Set(['bug', 'suggestion', 'other']);
const FEEDBACK_BODY_MAX = 2000;

// Member-submitted feedback for the Owner. Deliberately NOT run through
// validatePublicContent: testers may legitimately include contact details
// (which the phone detector would flag as spam).

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const input = (await request.json()) as Record<string, unknown>;
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
    await getDb().insert(feedback).values({
      id,
      authorId: member.id,
      category: category as (typeof feedback.category.enumValues)[number],
      body,
      status: 'open',
      createdAt: now,
    });
    return NextResponse.json({ id, status: 'open' }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET() {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

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
      .orderBy(desc(feedback.createdAt))
      .limit(100);
    return NextResponse.json({ items: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const member = await requireMember();
    if (member.role !== 'owner')
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const input = (await request.json()) as { id?: string; action?: string };
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

    const db = getDb();
    const [existing] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(eq(feedback.id, input.id))
      .limit(1);
    if (!existing)
      return NextResponse.json({ error: 'Feedback not found.' }, { status: 404 });

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
    await db.update(feedback).set(values).where(eq(feedback.id, input.id));
    return NextResponse.json({ id: input.id, status: values.status });
  } catch (error) {
    return apiError(error);
  }
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  const status = message === 'UNAUTHENTICATED' ? 401 : 500;
  return NextResponse.json(
    { error: status === 500 ? 'Unable to process the request.' : message },
    { status },
  );
}
