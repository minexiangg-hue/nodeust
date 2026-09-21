import { parseMatchPost } from './engine.ts';
import type { MatchPost, ParsedPost } from './types.ts';

// An added public input must be considered here before TypeScript will compile.
const inputs = {
  id: true, ownerId: true, category: true, title: true, body: true,
  currentHall: true, targetHall: true, roomType: true, genderEligibility: true,
  availableFrom: true, locationId: true, createdAt: true, updatedAt: true, status: true,
} satisfies Record<keyof MatchPost, true>;

/** Reuse only an identical public input, never just an unchanged update timestamp.
 * Fresh display metadata stays on the returned post even when intents are reused.
 */
export function parseCurrentMatchPost(post: MatchPost, cached?: ParsedPost): ParsedPost {
  const same = cached && (Object.keys(inputs) as Array<keyof MatchPost>).every(key => {
    const before = cached.post[key], after = post[key];
    if (key !== 'createdAt' && key !== 'updatedAt') return before === after;
    if (before === undefined || after === undefined) return before === after;
    const oldTime = new Date(before as string | Date).getTime();
    const newTime = new Date(after as string | Date).getTime();
    return Number.isFinite(oldTime) && oldTime === newTime;
  });
  return same ? { ...cached, post } : parseMatchPost(post);
}
