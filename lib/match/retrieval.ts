import type { MatchPost } from './types.ts';

/** Retrieval scores are search relevance, never evidence of compatibility. */
export type RetrievedCandidate = { id: string; score: number };
type Channel = 'words' | 'grams';
type Document = { post: MatchPost; terms: Record<Channel, Map<string, number>>; lengths: Record<Channel, number> };
const channels: Channel[] = ['words', 'grams'];
function terms(value: string, channel: Channel): Map<string, number> {
  const result = new Map<string, number>();
  const add = (token: string) => result.set(token, (result.get(token) ?? 0) + 1);
  const normalized = value.normalize('NFKC').toLowerCase();
  for (const match of normalized.matchAll(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu)) {
    const token = match[0];
    const chars = Array.from(token); // Search n-grams use code points, not display graphemes.
    if (channel === 'words' && !/\p{Script=Han}/u.test(token)) add(token);
    else {
      const n = channel === 'words' ? 2 : 3;
      if (chars.length < n) add(token);
      else for (let i = 0; i <= chars.length - n; i++) add(chars.slice(i, i + n).join(''));
    }
  }
  return result;
}

/** Sparse BM25 over public words/CJK bigrams and character trigrams. No category
 * filter or domain vocabulary. Two channels combine by reciprocal rank fusion.
 * This is an experimental candidate retriever, not a production recommender.
 */
export class TextCandidateIndex {
  private docs = new Map<string, Document>();
  private postings: Record<Channel, Map<string, Map<string, number>>> = {words: new Map(), grams: new Map()};
  private totalLengths: Record<Channel, number> = {words: 0, grams: 0};

  constructor(posts: readonly MatchPost[] = []) {
    for (const post of posts) this.add(post);
  }
  remove(id: string): void {
    const old = this.docs.get(id);
    if (!old) return;
    for (const channel of channels) {
      this.totalLengths[channel] -= old.lengths[channel];
      for (const token of old.terms[channel].keys()) {
        const posting = this.postings[channel].get(token)!;
        posting.delete(id);
        if (!posting.size) this.postings[channel].delete(token);
      }
    }
    this.docs.delete(id);
  }
  add(post: MatchPost): void {
    this.remove(post.id);
    if (post.status && post.status !== 'active') return;
    const text = `${post.title}\n${post.body}`;
    const parsed = {words: terms(text, 'words'), grams: terms(text, 'grams')};
    const lengths = {words: 0, grams: 0};
    for (const channel of channels) {
      for (const [token, count] of parsed[channel]) {
        lengths[channel] += count;
        const posting = this.postings[channel].get(token) ?? new Map<string, number>();
        posting.set(post.id, count);
        this.postings[channel].set(token, posting);
      }
      this.totalLengths[channel] += lengths[channel];
    }
    this.docs.set(post.id, {post: {...post}, terms: parsed, lengths});
  }
  search(query: MatchPost, options: {limit?: number; excludedOwners?: ReadonlySet<string>} = {}): RetrievedCandidate[] {
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Invalid retrieval limit');
    if (!limit || (query.status && query.status !== 'active')) return [];
    const combined = new Map<string, number>();
    for (const channel of channels) {
      const scores = new Map<string, number>();
      const average = this.totalLengths[channel] / this.docs.size || 1;
      for (const token of terms(`${query.title}\n${query.body}`, channel).keys()) {
        const posting = this.postings[channel].get(token);
        if (!posting) continue;
        const idf = Math.log(1 + (this.docs.size - posting.size + 0.5) / (posting.size + 0.5));
        for (const [id, tf] of posting) {
          const doc = this.docs.get(id)!;
          if (id === query.id || (query.ownerId && doc.post.ownerId === query.ownerId) ||
              (doc.post.ownerId && options.excludedOwners?.has(doc.post.ownerId))) continue;
          const score = idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * doc.lengths[channel] / average));
          scores.set(id, (scores.get(id) ?? 0) + score);
        }
      }
      const ranked = [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      // Fuse complete positive-overlap rankings before applying the caller's limit.
      ranked.forEach(([id], rank) => combined.set(id, (combined.get(id) ?? 0) + 1 / (60 + rank + 1)));
    }
    return [...combined].map(([id, score]) => ({id, score}))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
  }
}
