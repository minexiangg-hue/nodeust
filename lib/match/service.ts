import { and, asc, eq, gt, inArray, ne, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { getDb } from '@/db';
import {
  posts,
  users,
  conversations,
  conversationParticipants,
} from '@/db/schema';
import {
  MatchIndex,
  parseMatchPost,
  rankMatches,
  MATCH_VERSION,
} from './engine.ts';
import type { MatchPost } from './types.ts';

const fields = {
  id: posts.id,
  ownerId: posts.ownerId,
  category: posts.category,
  title: posts.title,
  body: posts.body,
  currentHall: posts.currentHall,
  targetHall: posts.targetHall,
  roomType: posts.roomType,
  genderEligibility: posts.genderEligibility,
  availableFrom: posts.availableFrom,
  locationId: posts.locationId,
  status: posts.status,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  replyCount: posts.replyCount,
  anonymousAlias: users.anonymousAlias,
};
type PublicRow = MatchPost & { replyCount: number; anonymousAlias: string };
import { matchIndexState as state } from './cache-state.ts';

async function buildIndex(): Promise<MatchIndex> {
  const all: PublicRow[] = [];
  let after = '';
  while (true) {
    const batch = await getDb()
      .select(fields)
      .from(posts)
      .innerJoin(users, eq(users.id, posts.ownerId))
      .where(
        and(
          eq(posts.status, 'active'),
          eq(users.status, 'active'),
          after ? gt(posts.id, after) : undefined,
        ),
      )
      .orderBy(asc(posts.id))
      .limit(500);
    all.push(...batch);
    if (batch.length < 500) break;
    after = batch[batch.length - 1].id;
  }
  return new MatchIndex(all);
}
async function loadIndex(): Promise<MatchIndex> {
  while (true) {
    if (state.snapshot && state.snapshot.expires > Date.now())
      return state.snapshot.index;
    if (!state.pending) {
      const generation = state.generation;
      const pending = buildIndex().then((index) => ({ index, generation }));
      state.pending = pending;
      // Only the owner of this build clears it; an older completion cannot clear a newer build.
      void pending
        .finally(() => {
          if (state.pending === pending) state.pending = undefined;
        })
        .catch(() => {});
    }
    const built = await state.pending;
    // An edit during an in-flight build invalidates the result, including current waiters.
    if (built.generation !== state.generation) continue;
    state.snapshot = { index: built.index, expires: Date.now() + 10000 };
    return built.index;
  }
}

export async function getMemberMatches(
  memberId: string,
  options: { offset: number; includePossible?: boolean; kind?: string },
  now = new Date(),
) {
  const me = conversationParticipants;
  const peer = alias(conversationParticipants, 'match_peer');
  const [ownRows, blocked, index] = await Promise.all([
    getDb()
      .select(fields)
      .from(posts)
      .innerJoin(users, eq(users.id, posts.ownerId))
      .where(and(eq(posts.ownerId, memberId), eq(posts.status, 'active'))),
    getDb()
      .select({ peerId: peer.userId })
      .from(me)
      .innerJoin(
        peer,
        and(
          eq(peer.conversationId, me.conversationId),
          ne(peer.userId, memberId),
        ),
      )
      .innerJoin(conversations, eq(conversations.id, me.conversationId))
      .where(
        and(
          eq(me.userId, memberId),
          or(
            eq(me.isBlocked, true),
            eq(peer.isBlocked, true),
            eq(conversations.status, 'blocked'),
          ),
        ),
      ),
    loadIndex(),
  ]);
  const parseCurrent = (post: PublicRow) => {
    const cached = index.posts.get(post.id);
    return cached &&
      new Date(cached.post.updatedAt || cached.post.createdAt).getTime() ===
        new Date(post.updatedAt || post.createdAt).getTime() &&
      cached.post.title === post.title &&
      cached.post.body === post.body &&
      cached.post.currentHall === post.currentHall &&
      cached.post.targetHall === post.targetHall
      ? { ...cached, post }
      : parseMatchPost(post);
  };
  const own = ownRows.map(parseCurrent);
  const blockedOwners = new Set(blocked.map((row) => row.peerId));
  const ids = [...index.candidates(own)].filter((id) => {
    const ownerId = index.posts.get(id)?.post.ownerId;
    return ownerId && ownerId !== memberId && !blockedOwners.has(ownerId);
  });
  const candidates: PublicRow[] = [];
  // Revalidate content, visibility and account state on every request. Cached parses
  // cannot expose a just-removed post or continue recommending an edited constraint.
  for (let start = 0; start < ids.length; start += 500) {
    const rows = await getDb()
      .select(fields)
      .from(posts)
      .innerJoin(users, eq(users.id, posts.ownerId))
      .where(
        and(
          inArray(posts.id, ids.slice(start, start + 500)),
          eq(posts.status, 'active'),
          eq(users.status, 'active'),
          ne(posts.ownerId, memberId),
        ),
      );
    candidates.push(...rows.filter((row) => !blockedOwners.has(row.ownerId)));
  }
  const ranked = rankMatches(own, candidates.map(parseCurrent), now);
  const visible = ranked.filter(
    (row) =>
      (options.includePossible || row.confidence === 'high') &&
      (!options.kind || row.kind === options.kind),
  );
  const details = new Map(candidates.map((row) => [row.id, row]));
  return {
    version: MATCH_VERSION,
    items: visible.slice(options.offset, options.offset + 25).map((match) => {
      const row = details.get(match.post.id)!;
      // Explicit allowlist: identity, owner ID and hidden account fields never leave the server.
      return {
        id: row.id,
        category: row.category,
        title: row.title,
        body: row.body,
        locationId: row.locationId,
        currentHall: row.currentHall,
        targetHall: row.targetHall,
        createdAt: row.createdAt,
        replyCount: row.replyCount,
        anonymousAlias: row.anonymousAlias,
        isMine: false,
        match: {
          kind: match.kind,
          confidence: match.confidence,
          reasons: match.reasons,
          missing: match.missing,
          ownPostId: match.ownPostId,
        },
      };
    }),
    hasMore: visible.length > options.offset + 25,
    total: visible.length,
    highConfidenceCount: ranked.filter((row) => row.confidence === 'high')
      .length,
    possibleCount: ranked.filter((row) => row.confidence === 'possible').length,
    ownPostCount: own.length,
    needsDetails: own
      .filter(
        (row) =>
          !row.intents.length ||
          row.intents.every((intent) => intent.missing.length),
      )
      .map((row) => ({
        id: row.post.id,
        title: row.post.title,
        missing: [
          ...new Set(
            row.intents.length
              ? row.intents.flatMap((intent) => intent.missing)
              : row.warnings,
          ),
        ],
      })),
  };
}
