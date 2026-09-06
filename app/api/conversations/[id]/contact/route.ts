import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import {
  contactExchangeRequests,
  conversationParticipants,
  messages,
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

    const now = new Date();
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

    // Request already exists — surface its current state without spamming the
    // thread with a duplicate request notice.
    if (exchange)
      return NextResponse.json({ id: exchange.id, status: exchange.status });

    await getDb()
      .insert(contactExchangeRequests)
      .values({
        id: crypto.randomUUID(),
        conversationId: id,
        requesterId: member.id,
        recipientId: recipient.userId,
        createdAt: now,
        updatedAt: now,
      });

    // A request row in the message stream is how the recipient learns (without
    // polling a separate endpoint) that an exchange is waiting on them.
    await getDb().insert(messages).values({
      id: crypto.randomUUID(),
      conversationId: id,
      senderId: member.id,
      kind: 'contact_request',
      body: '',
      createdAt: now,
    });

    const [fresh] = await getDb()
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
      { id: fresh.id, status: fresh.status },
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

    // Persist the reveal inside the thread (one row per member, visible to both
    // participants) so the requester — who never sees the PATCH response — can
    // also read the other side's contact through the normal message feed.
    const now = new Date();
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
    const revealBody = (contact: (typeof contacts)[number]) => {
      const line = [contact.method, contact.value].filter(Boolean).join(' · ');
      return line || '(未设置联系方式 / no contact saved)';
    };
    const revealRows = [exchange.requesterId, exchange.recipientId].map(
      (userId) => ({
        id: crypto.randomUUID(),
        conversationId: id,
        senderId: userId,
        kind: 'contact_reveal' as const,
        body: revealBody(
          contactById.get(userId) ?? {
            id: userId,
            alias: '',
            method: null,
            value: null,
          },
        ),
        createdAt: now,
      }),
    );
    await getDb().insert(messages).values(revealRows);

    return NextResponse.json({ id: exchange.id, status: 'accepted', contacts });
  } catch {
    return NextResponse.json(
      { error: '无法确认联系方式交换。' },
      { status: 500 },
    );
  }
}
