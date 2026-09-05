import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { conversationParticipants, conversations, posts } from '@/db/schema';
import { requireMember } from '@/lib/current-member';

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const { postId } = (await request.json()) as { postId?: string };
    if (!postId)
      return NextResponse.json({ error: '缺少需求编号。' }, { status: 400 });
    const [post] = await getDb()
      .select()
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.status, 'active')))
      .limit(1);
    if (!post)
      return NextResponse.json(
        { error: '需求不存在或已经关闭。' },
        { status: 404 },
      );
    if (post.ownerId === member.id)
      return NextResponse.json(
        { error: '不能与自己发起匿名会话。' },
        { status: 409 },
      );

    const id = crypto.randomUUID();
    const now = new Date();
    await getDb().batch([
      getDb()
        .insert(conversations)
        .values({ id, postId, createdAt: now, updatedAt: now }),
      getDb()
        .insert(conversationParticipants)
        .values([
          {
            id: crypto.randomUUID(),
            conversationId: id,
            userId: member.id,
            joinedAt: now,
          },
          {
            id: crypto.randomUUID(),
            conversationId: id,
            userId: post.ownerId,
            joinedAt: now,
          },
        ]),
    ]);
    return NextResponse.json({ id, status: 'active' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === 'UNAUTHENTICATED'
            ? '请先登录。'
            : '无法创建会话。',
      },
      { status: 500 },
    );
  }
}
