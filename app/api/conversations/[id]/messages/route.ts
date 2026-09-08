import { and, desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import {
  conversationParticipants,
  conversations,
  messages,
  users,
} from '@/db/schema';
import { apiError, readJsonObject } from '@/lib/api-response';
import { requireMember } from '@/lib/current-member';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    if (!(await isParticipant(id, member.id)))
      return NextResponse.json({ error: '无权查看此会话。' }, { status: 403 });
    const items = await getDb()
      .select({
        id: messages.id,
        body: messages.body,
        kind: messages.kind,
        createdAt: messages.createdAt,
        alias: users.anonymousAlias,
        senderId: messages.senderId,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(300);
    return NextResponse.json({
      items: items.reverse().map(({ senderId, ...message }) => ({
        ...message,
        isMine: senderId === member.id,
      })),
    });
  } catch (error) {
    return apiError(error, '无法读取会话。');
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    if (!(await isParticipant(id, member.id, true)))
      return NextResponse.json({ error: '无权回复此会话。' }, { status: 403 });
    const input = await readJsonObject(request);
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (!body || body.length > 2000)
      return NextResponse.json(
        { error: '消息不能为空且不能超过 2000 字。' },
        { status: 422 },
      );
    const messageId = crypto.randomUUID();
    const now = new Date();
    await getDb().transaction(async (transaction) => {
      await transaction.insert(messages).values({
        id: messageId,
        conversationId: id,
        senderId: member.id,
        body,
        createdAt: now,
      });
      await transaction
        .update(conversations)
        .set({ updatedAt: now })
        .where(eq(conversations.id, id));
    });
    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch (error) {
    return apiError(error, '消息发送失败。');
  }
}

async function isParticipant(
  conversationId: string,
  userId: string,
  requireActive = false,
) {
  const [participant] = await getDb()
    .select({
      id: conversationParticipants.id,
      isBlocked: conversationParticipants.isBlocked,
      status: conversations.status,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationParticipants.conversationId),
    )
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(
    participant &&
    !participant.isBlocked &&
    (!requireActive || participant.status === 'active'),
  );
}
