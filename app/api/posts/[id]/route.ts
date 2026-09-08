import { and, eq, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { posts } from '@/db/schema';
import { apiError, readJsonObject } from '@/lib/api-response';
import { requireMember } from '@/lib/current-member';

type Context = { params: Promise<{ id: string }> };

// Keep the row for conversation/report references. Removed posts cannot be reopened.
export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    const [result] = await getDb()
      .update(posts)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(
        and(
          eq(posts.id, id),
          eq(posts.ownerId, member.id),
          ne(posts.status, 'removed'),
        ),
      );
    if (!result.affectedRows)
      return NextResponse.json(
        { error: 'Post unavailable or already removed.' },
        { status: 404 },
      );
    return NextResponse.json({ id, status: 'removed' });
  } catch (error) {
    return apiError(error, 'Unable to delete the post.');
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    const input = await readJsonObject(request);
    if (input.action !== 'close' && input.action !== 'reopen')
      return NextResponse.json(
        { error: 'Invalid post action.' },
        { status: 400 },
      );
    const status = input.action === 'close' ? 'closed' : 'active';
    const [result] = await getDb()
      .update(posts)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(posts.id, id),
          eq(posts.ownerId, member.id),
          eq(posts.status, input.action === 'close' ? 'active' : 'closed'),
        ),
      );
    if (!result.affectedRows)
      return NextResponse.json(
        {
          error:
            'Post unavailable or its status changed. Refresh and try again.',
        },
        { status: 409 },
      );
    return NextResponse.json({ id, status });
  } catch (error) {
    return apiError(error, 'Unable to update the post.');
  }
}
