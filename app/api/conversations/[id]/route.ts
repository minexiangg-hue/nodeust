import { and, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  conversationParticipants,
  conversations,
  posts,
  users,
} from '@/db/schema';
import { requireMember } from '@/lib/current-member';
import { apiError } from '@/lib/api-response';

// Direct conversation navigation must not depend on the 200-row inbox window.
// Return only anonymous peer metadata after joining the caller's membership.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const member = await requireMember();
    const { id } = await context.params;
    const mine = conversationParticipants;
    const peer = alias(conversationParticipants, 'peer');
    const [session] = await getDb()
      .select({
        conversationId: conversations.id,
        peerAlias: users.anonymousAlias,
        postId: conversations.postId,
        postTitle: posts.title,
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
      .innerJoin(users, eq(users.id, peer.userId))
      .leftJoin(posts, eq(posts.id, conversations.postId))
      .where(
        and(
          eq(conversations.id, id),
          eq(mine.isBlocked, false),
          ne(conversations.status, 'blocked'),
        ),
      )
      .limit(1);
    if (!session)
      return NextResponse.json(
        { error: 'Conversation unavailable.' },
        { status: 404 },
      );
    return NextResponse.json({
      session: { ...session, postTitle: session.postTitle ?? '' },
    });
  } catch (error) {
    return apiError(error, 'Unable to load conversation.');
  }
}
