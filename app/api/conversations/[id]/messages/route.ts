import { and, asc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { conversationParticipants, messages, users } from '@/db/schema';
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
        isMine: eq(messages.senderId, member.id),
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt))
      .limit(300);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: '无法读取会话。' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    if (!(await isParticipant(id, member.id)))
      return NextResponse.json({ error: '无权回复此会话。' }, { status: 403 });
    const input = (await request.json()) as { body?: string };
    const body = input.body?.trim();
    if (!body || body.length > 2000)
      return NextResponse.json(
        { error: '消息不能为空且不能超过 2000 字。' },
        { status: 422 },
      );
    const messageId = crypto.randomUUID();
    await getDb()
      .insert(messages)
      .values({
        id: messageId,
        conversationId: id,
        senderId: member.id,
        body,
        createdAt: new Date(),
      });
    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '消息发送失败。' }, { status: 500 });
  }
}

async function isParticipant(conversationId: string, userId: string) {
  const [participant] = await getDb()
    .select({
      id: conversationParticipants.id,
      isBlocked: conversationParticipants.isBlocked,
    })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(participant && !participant.isBlocked);
}
