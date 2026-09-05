import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import {
  contactExchangeRequests,
  conversationParticipants,
  users,
} from '@/db/schema';
import { requireMember } from '@/lib/current-member';

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    const participants = await getDb()
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, id));
    if (
      !participants.some(
        (participant) =>
          participant.userId === member.id && !participant.isBlocked,
      )
    )
      return NextResponse.json({ error: '无权操作此会话。' }, { status: 403 });
    const recipient = participants.find(
      (participant) => participant.userId !== member.id,
    );
    if (!recipient)
      return NextResponse.json(
        { error: '会话参与者不完整。' },
        { status: 409 },
      );

    const requestId = crypto.randomUUID();
    const now = new Date();
    await getDb()
      .insert(contactExchangeRequests)
      .values({
        id: requestId,
        conversationId: id,
        requesterId: member.id,
        recipientId: recipient.userId,
        createdAt: now,
        updatedAt: now,
      })
      .onDuplicateKeyUpdate({ set: { updatedAt: now } });
    const [exchange] = await getDb()
      .select()
      .from(contactExchangeRequests)
      .where(
        and(
          eq(contactExchangeRequests.conversationId, id),
          eq(contactExchangeRequests.requesterId, member.id),
          eq(contactExchangeRequests.recipientId, recipient.userId),
        ),
      )
      .limit(1);
    return NextResponse.json(
      { id: exchange.id, status: exchange.status },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: '无法发起联系方式交换。' },
      { status: 500 },
    );
  }
}

export async function PATCH(_request: NextRequest, context: Context) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    const [exchange] = await getDb()
      .select()
      .from(contactExchangeRequests)
      .where(
        and(
          eq(contactExchangeRequests.conversationId, id),
          eq(contactExchangeRequests.recipientId, member.id),
          eq(contactExchangeRequests.status, 'pending'),
        ),
      )
      .limit(1);
    if (!exchange)
      return NextResponse.json(
        { error: '没有等待你确认的交换请求。' },
        { status: 404 },
      );
    await getDb()
      .update(contactExchangeRequests)
      .set({
        recipientConsent: true,
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(contactExchangeRequests.id, exchange.id));
    const contacts = await getDb()
      .select({
        id: users.id,
        alias: users.anonymousAlias,
        method: users.contactMethod,
        value: users.contactValue,
      })
      .from(users)
      .where(inArray(users.id, [exchange.requesterId, exchange.recipientId]));
    return NextResponse.json({ id: exchange.id, status: 'accepted', contacts });
  } catch {
    return NextResponse.json(
      { error: '无法确认联系方式交换。' },
      { status: 500 },
    );
  }
}
