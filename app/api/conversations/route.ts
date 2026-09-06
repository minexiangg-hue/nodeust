import { and, desc, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import {
  conversationParticipants,
  conversations,
  messages,
  posts,
  users,
} from '@/db/schema';
import { requireMember } from '@/lib/current-member';

// A participant may never be the peer of an exchange with themselves; this
// marks the *other* side of each conversation so a member can list the chats
// that have reached them (e.g. a poster seeing that someone opened a thread on
// their request).
const peer = alias(conversationParticipants, 'peer');

export async function GET() {
  try {
    const member = await requireMember();
    const mine = conversationParticipants;
    const rows = await getDb()
      .select({
        id: conversations.id,
        status: conversations.status,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        postId: conversations.postId,
        postTitle: posts.title,
        postCategory: posts.category,
        peerId: users.id,
        peerAlias: users.anonymousAlias,
      })
      .from(conversations)
      .innerJoin(
        mine,
        and(
          eq(mine.conversationId, conversations.id),
          eq(mine.userId, member.id),
        ),
      )
      .innerJoin(
        peer,
        and(
          eq(peer.conversationId, conversations.id),
          ne(peer.userId, member.id),
        ),
      )
      .innerJoin(users, eq(peer.userId, users.id))
      .leftJoin(posts, eq(conversations.postId, posts.id))
      .where(
        and(eq(mine.isBlocked, false), eq(conversations.status, 'active')),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(200);

    const items = await Promise.all(
      rows.map(async (row) => {
        const [last] = await getDb()
          .select({
            id: messages.id,
            body: messages.body,
            kind: messages.kind,
            createdAt: messages.createdAt,
            senderId: messages.senderId,
          })
          .from(messages)
          .where(eq(messages.conversationId, row.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        return {
          id: row.id,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          postId: row.postId,
          post: row.postId
            ? {
                id: row.postId,
                title: row.postTitle ?? '',
                category: row.postCategory ?? 'other',
              }
            : null,
          peerId: row.peerId,
          peerAlias: row.peerAlias,
          lastMessage: last
            ? {
                id: last.id,
                body: last.body,
                kind: last.kind,
                createdAt: last.createdAt,
                isMine: last.senderId === member.id,
              }
            : null,
        };
      }),
    );
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: '无法读取会话列表。' },
      { status: 500 },
    );
  }
}

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

    // Reuse an existing open thread between the two members for this post
    // instead of creating a duplicate inbox row on every click.
    const [existing] = await getDb()
      .select({ id: conversations.id, status: conversations.status })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversationParticipants.conversationId, conversations.id),
          eq(conversationParticipants.userId, member.id),
        ),
      )
      .innerJoin(
        peer,
        and(
          eq(peer.conversationId, conversations.id),
          eq(peer.userId, post.ownerId),
        ),
      )
      .where(
        and(eq(conversations.postId, postId), eq(conversations.status, 'active')),
      )
      .limit(1);
    if (existing)
      return NextResponse.json({
        id: existing.id,
        status: existing.status,
        reused: true,
      });

    const id = crypto.randomUUID();
    const now = new Date();
    await getDb().transaction(async (transaction) => {
      await transaction
        .insert(conversations)
        .values({ id, postId, createdAt: now, updatedAt: now });
      await transaction.insert(conversationParticipants).values([
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
      ]);
    });
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
