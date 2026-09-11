import type { MatchIntent, MatchPost, ParsedPost, PairMatch } from './types.ts';
import { parseHousing, parseGoods } from './housing-goods.ts';
import { parseTransport, parseStudy, parseSocial } from './mobility-study.ts';
import { compareResidencePeriods, compareRoomAcceptance, parseResidenceLabel, compareMoney } from './constraints.ts';
import type { RoomType } from './constraints.ts';

export const MATCH_VERSION = 'reciprocal-intents-v5';
export const TIME_TOLERANCE_MINUTES = 30;

export function parseMatchPost(post: MatchPost): ParsedPost {
  if (post.status && post.status !== 'active')
    return { post, intents: [], warnings: ['inactive'] };
  const intents = [
    parseHousing,
    parseGoods,
    parseTransport,
    parseStudy,
    parseSocial,
  ]
    .flatMap((parse) => parse(post))
    .map((intent) => ({ ...intent, missing: missingIntentDetails(intent) }));
  const seen = new Set<string>();
  return {
    post,
    intents: intents.filter((intent) => {
      const key = JSON.stringify({ ...intent, evidence: [] });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    warnings: intents.length ? [] : ['describe-request'],
  };
}

export function missingIntentDetails(intent: MatchIntent): string[] {
  const fields: Array<keyof MatchIntent> =
    intent.kind === 'hall'
      ? ['from', 'to', 'term', 'room', 'wantedRoom', 'eligibility']
      : intent.kind === 'goods'
        ? ['price']
        : intent.kind === 'study'
          ? ['date', 'minute', 'communication']
          : intent.kind === 'transport'
            ? [
                'from',
                'to',
                'date',
                'minute',
                ...(intent.side === 'driver'
                  ? ['seats' as const]
                  : ['party' as const]),
                ...(intent.side === 'share' ? ['capacity' as const] : []),
              ]
            : ['date', 'minute', 'place'];
  return [
    ...new Set([
      ...intent.missing,
      ...fields
        .filter((field) => !(field === 'wantedRoom' && intent.wantedRooms?.length) && (intent[field] === undefined || intent[field] === ''))
        .map((field) => (field === 'minute' ? 'time' : field)),
    ]),
  ];
}

export function isExpired(intent: MatchIntent, now: Date): boolean {
  if (intent.kind === 'hall') {
    const period = parseResidenceLabel(intent.term);
    // Only explicit endpoints support expiry here; semester labels are not a school calendar.
    if (period?.type === 'dates') return new Date(`${period.end}T23:59:59.999+08:00`).getTime() < now.getTime();
    if (period?.type === 'academic-year') {
      const currentYear = new Date(now.getTime() + 8 * 60 * 60 * 1000).getUTCFullYear();
      return period.endYear < currentYear;
    }
    return false;
  }
  if (
    !intent.date ||
    !['transport', 'study', 'other', 'goods'].includes(intent.kind)
  )
    return false;
  const cutoff =
    new Date(`${intent.date}T00:00:00+08:00`).getTime() +
    ((intent.endMinute ?? intent.minute ?? 1439) +
      (intent.strictTime ? 0 : TIME_TOLERANCE_MINUTES)) *
      60000;
  return cutoff < now.getTime();
}
function differs(a?: string, b?: string): boolean {
  return Boolean(a && b && a !== b);
}

/** Compatibility is symmetric; score describes evidence strength, never success probability. */
export function compareIntents(
  a: MatchIntent,
  b: MatchIntent,
  now = new Date(),
): PairMatch | null {
  if (a.kind !== b.kind || isExpired(a, now) || isExpired(b, now)) return null;
  const missing = new Set([...a.missing, ...b.missing]);
  const reasons: PairMatch['reasons'] = [];
  const required = (key: keyof MatchIntent, code: string) => {
    if (a[key] === undefined || b[key] === undefined) missing.add(code);
  };
  const feesFit = (offer: MatchIntent, seek: MatchIntent): boolean => {
    if (!offer.fee && !seek.fee) return true;
    const asking = offer.fee?.amount, maximum = seek.fee?.amount;
    // Free provision also fits a request that imposes no financial limit.
    if (asking === 0 && !seek.fee) return true;
    if (typeof asking === 'number' && asking > 0 && maximum === 0) return false;
    const comparison = compareMoney(offer.fee, seek.fee);
    if (comparison.status === 'conflict') return false;
    if (comparison.status === 'unknown') missing.add(a.kind === 'study' ? 'study-fee' : 'fare');
    else reasons.push({code:'fee-compatible'});
    return true;
  };
  if (a.kind === 'hall') {
    if ([a, b].some(intent => intent.allocation === 'denied' || intent.exchangeEligibility === 'ineligible')) return null;
    if ([a, b].some(intent => intent.allocation === 'pending')) missing.add('allocation');
    if ([a, b].some(intent => intent.exchangeEligibility === 'pending')) missing.add('exchange-eligibility');
    if (
      !a.from ||
      !a.to ||
      !b.from ||
      !b.to ||
      a.from !== b.to ||
      a.to !== b.from ||
      a.from === a.to
    )
      return null;
    // Existing posts can state only a season. Preserve that declared scope without
    // inventing calendar years; an explicit year on either side still needs confirmation.
    const seasons = ['fall', 'spring', 'summer', 'winter'];
    if (a.term && b.term && seasons.includes(a.term) && seasons.includes(b.term)) {
      if (a.term !== b.term) return null;
      reasons.push({ code: 'term-year-unspecified', values: [a.term] });
    } else {
      const period = compareResidencePeriods(parseResidenceLabel(a.term), parseResidenceLabel(b.term), 'equal');
      if (period.status === 'conflict') return null;
      if (period.status === 'unknown') missing.add('term');
    }
    for (const [offer, seek] of [[a, b], [b, a]]) {
      const wanted = seek.wantedRooms?.length
        ? seek.wantedRooms as RoomType[]
        : seek.wantedRoom === 'any' ? 'any' : seek.wantedRoom ? [seek.wantedRoom as RoomType] : undefined;
      const room = compareRoomAcceptance(offer.room as RoomType | undefined, wanted);
      if (room.status === 'conflict') return null;
      if (room.status === 'unknown') missing.add('room');
    }
    if (
      a.eligibility !== 'any' &&
      b.eligibility !== 'any' &&
      differs(a.eligibility, b.eligibility)
    )
      return null;
    for (const key of ['term', 'room', 'eligibility'] as const)
      required(key, key);
    reasons.push(
      { code: 'reverse-route', values: [a.from, a.to] },
      { code: 'housing-conditions' },
    );
  } else {
    if (!a.entity || a.entity !== b.entity || a.entity.startsWith('unknown-'))
      return null;
    if (a.kind === 'goods') {
      if (
        !(
          (a.side === 'offer' && b.side === 'seek') ||
          (b.side === 'offer' && a.side === 'seek')
        )
      )
        return null;
      const offer = a.side === 'offer' ? a : b,
        seek = a.side === 'seek' ? a : b;
      const sameCurrency = Boolean(offer.currency && seek.currency && offer.currency === seek.currency);
      const offeredBasis = offer.priceBasis === 'unit' ? 'item' : offer.priceBasis === 'total' ? 'bundle' : undefined;
      const wantedBasis = seek.priceBasis === 'unit' ? 'item' : seek.priceBasis === 'total' ? 'bundle' : undefined;
      const multipleItems = (offer.quantity ?? 0) > 1 || (seek.quantity ?? 0) > 1;
      // Unqualified quotes can describe one listing. Once quantities or units are
      // explicitly different, compare only a known common transaction scope.
      const unqualifiedQuotes = !offeredBasis && !wantedBasis && !multipleItems;
      const sameBundle = offeredBasis !== 'bundle' || (offer.quantity !== undefined && offer.quantity === seek.quantity);
      let budgetFits = false;
      if (offer.price === 0 && seek.price !== undefined) {
        budgetFits = compareMoney({ amount: 0 }, { amount: seek.price }).status === 'compatible';
      } else if (unqualifiedQuotes) {
        if (!sameCurrency) missing.add('currency');
        if (sameCurrency && offer.price !== undefined && seek.price !== undefined) {
          if (offer.price > seek.price) return null;
          budgetFits = true;
        }
      } else if (!sameBundle) {
        missing.add('bundle_price');
      } else {
        const comparison = compareMoney(
          { amount: offer.price, currency: offer.currency, basis: offeredBasis, scope: 'asking' },
          { amount: seek.price, currency: seek.currency, basis: wantedBasis, scope: 'maximum' },
          { itemQuantity: seek.quantity },
        );
        if (comparison.status === 'conflict') return null;
        if (comparison.status === 'unknown') {
          if (!sameCurrency) missing.add('currency');
          if (!offeredBasis || !wantedBasis) missing.add('price-basis');
          if (offeredBasis && wantedBasis && offeredBasis !== wantedBasis && !seek.quantity) missing.add('quantity');
          missing.add('price-comparison');
        } else budgetFits = true;
      }
      if (differs(a.model, b.model) || differs(a.edition, b.edition))
        return null;
      if (
        offer.quantity !== undefined &&
        seek.quantity !== undefined &&
        offer.quantity < seek.quantity
      )
        return null;
      if (
        seek.quantity !== undefined &&
        seek.quantity > 1 &&
        offer.quantity === undefined
      )
        missing.add('quantity');
      if (
        (a.quantity !== undefined && a.quantity <= 0) ||
        (b.quantity !== undefined && b.quantity <= 0)
      )
        return null;
      if (seek.edition && !offer.edition) missing.add('edition');
      if (
        seek.colors?.length &&
        !seek.colors.includes('any') &&
        !offer.colors?.length
      )
        missing.add('color');
      if (
        seek.colors?.length &&
        !seek.colors.includes('any') &&
        offer.colors?.length &&
        !seek.colors.some((color) => offer.colors!.includes(color))
      )
        return null;
      if (differs(a.place, b.place) || differs(a.date, b.date)) return null;
      for (const key of ['place', 'date', 'minute'] as const)
        if ((a[key] !== undefined) !== (b[key] !== undefined))
          missing.add(key === 'minute' ? 'time' : key);
      if (
        a.minute !== undefined &&
        b.minute !== undefined &&
        Math.max(
          a.minute - (b.endMinute ?? b.minute),
          b.minute - (a.endMinute ?? a.minute),
          0,
        ) > 0
      )
        return null;
      // A requested model/condition needs evidence from the offered item.
      if (seek.model && !offer.model) missing.add('model');
      if (seek.condition && !offer.condition) missing.add('condition');
      if (
        seek.condition === 'new' &&
        offer.condition &&
        offer.condition !== 'new'
      )
        return null;
      if (offer.condition === 'broken' && seek.condition !== 'broken')
        return null;
      required('price', 'price');
      reasons.push({ code: 'supply-demand', values: [a.entity] });
      if (budgetFits)
        reasons.push({
          code: 'within-budget',
          values: [String(offer.price), String(seek.price)],
        });
    } else {
      if (differs(a.date, b.date)) return null;
      required('date', 'date');
      required('minute', 'time');
      if (a.minute !== undefined && b.minute !== undefined) {
        const distance = Math.max(
          a.minute - (b.endMinute ?? b.minute),
          b.minute - (a.endMinute ?? a.minute),
          0,
        );
        if (
          distance > (a.strictTime || b.strictTime ? 0 : TIME_TOLERANCE_MINUTES)
        )
          return null;
        reasons.push({
          code: 'time-compatible',
          values: [a.date || '', String(distance)],
        });
      }
      if (a.kind === 'transport') {
        if (
          !a.from ||
          !a.to ||
          a.from !== b.from ||
          a.to !== b.to ||
          a.from === a.to
        )
          return null;
        if (a.side === 'share' && b.side === 'share') {
          if (a.fee || b.fee) missing.add('fare');
          required('party', 'party');
          required('capacity', 'capacity');
          if (
            a.party !== undefined &&
            b.party !== undefined &&
            a.capacity !== undefined &&
            b.capacity !== undefined &&
            a.party + b.party > Math.min(a.capacity, b.capacity)
          )
            return null;
        } else {
          if (
            !(
              (a.side === 'driver' && b.side === 'rider') ||
              (b.side === 'driver' && a.side === 'rider')
            )
          )
            return null;
          const driver = a.side === 'driver' ? a : b,
            rider = a.side === 'rider' ? a : b;
          if (!feesFit(driver, rider)) return null;
          if (driver.seats === undefined) missing.add('seats');
          if (rider.party === undefined) missing.add('party');
          if (
            driver.seats !== undefined &&
            rider.party !== undefined &&
            driver.seats < rider.party
          )
            return null;
        }
        for (const [offer, seek] of [[a,b],[b,a]]) {
          if (offer.luggageLimit === undefined) continue;
          if (seek.luggage === 0) continue;
          if (seek.luggage === undefined) { missing.add('luggage'); continue; }
          if (!offer.luggageLimitKind || !seek.luggageKind || (seek.luggageKind === 'bag' && offer.luggageLimitKind !== 'any')) {
            missing.add('luggage-type'); continue;
          }
          if ((offer.luggageLimitKind === 'any' || offer.luggageLimitKind === seek.luggageKind) && seek.luggage > offer.luggageLimit) return null;
        }
        reasons.push(
          { code: 'same-route', values: [a.from, a.to] },
          { code: 'compatible-transport' },
        );
      } else if (a.kind === 'study') {
        if (
          !(
            (a.side === 'peer' && b.side === 'peer') ||
            (a.side === 'offer' && b.side === 'seek') ||
            (a.side === 'seek' && b.side === 'offer')
          )
        )
          return null;
        if (
          a.communication &&
          b.communication &&
          a.communication !== 'any' &&
          b.communication !== 'any' &&
          !a.communication
            .split('|')
            .some((language) => b.communication!.split('|').includes(language))
        )
          return null;
        if (a.side === 'offer' && !feesFit(a, b)) return null;
        if (b.side === 'offer' && !feesFit(b, a)) return null;
        if (a.side === 'peer' && (a.fee || b.fee)) missing.add('study-fee');
        required('communication', 'communication');
        if (differs(a.place, b.place)) return null;
        if (Boolean(a.place) !== Boolean(b.place)) missing.add('place');
        if (
          a.topics?.length &&
          b.topics?.length &&
          !a.topics.some((topic) => b.topics!.includes(topic))
        )
          return null;
        if (
          (a.topics?.length && !b.topics?.length) ||
          (b.topics?.length && !a.topics?.length)
        )
          missing.add('topic');
        for (const [request, peer] of [
          [a, b],
          [b, a],
        ]) {
          if (
            request.requiredTopics?.length &&
            peer.topics?.length &&
            !request.requiredTopics.every((topic) =>
              peer.topics!.includes(topic),
            )
          )
            return null;
          if (request.requiredTopics?.length && !peer.topics?.length)
            missing.add('topic');
        }
        reasons.push({ code: 'study-partners', values: [a.entity] });
      } else {
        const peers = a.side === 'peer' && b.side === 'peer';
        const hostAndGuest = (a.side === 'offer' && b.side === 'seek') || (b.side === 'offer' && a.side === 'seek');
        if ((!peers && !hostAndGuest) || differs(a.place, b.place)) return null;
        if (hostAndGuest) {
          const host = a.side === 'offer' ? a : b, guest = a.side === 'seek' ? a : b;
          if (host.seats === undefined) missing.add('activity-places');
          if (guest.party === undefined) missing.add('participants');
          if (host.seats !== undefined && guest.party !== undefined && host.seats < guest.party) return null;
        }
        for (const [request, peer] of [[a,b],[b,a]]) {
          if (request.seats !== undefined && peer.party !== undefined && request.seats < peer.party) return null;
          if (request.requiredEquipment?.length) {
            if (!peer.equipment?.length) missing.add('equipment');
            else if (!request.requiredEquipment.every(item => peer.equipment!.includes(item))) missing.add('equipment');
          }
        }
        if (a.communication && b.communication && a.communication !== 'any' && b.communication !== 'any'
          && !a.communication.split('|').some(language => b.communication!.split('|').includes(language))) return null;
        if (Boolean(a.communication) !== Boolean(b.communication)) missing.add('communication');
        required('place', 'place');
        if (a.requiredSkill && b.skill && a.requiredSkill !== b.skill)
          return null;
        if (b.requiredSkill && a.skill && b.requiredSkill !== a.skill)
          return null;
        if ((a.requiredSkill && !b.skill) || (b.requiredSkill && !a.skill))
          missing.add('skill');
        reasons.push({
          code: 'activity-partners',
          values: [a.entity, a.place || ''],
        });
      }
    }
  }
  return {
    kind: a.kind,
    confidence: missing.size ? 'possible' : 'high',
    score: missing.size ? Math.max(10, 65 - missing.size * 5) : 100,
    reasons,
    missing: [...missing].sort(),
  };
}

export function comparePosts(
  a: ParsedPost,
  b: ParsedPost,
  now = new Date(),
): PairMatch | null {
  if (
    a.post.id === b.post.id ||
    (a.post.ownerId && a.post.ownerId === b.post.ownerId)
  )
    return null;
  let best: PairMatch | null = null;
  for (const x of a.intents)
    for (const y of b.intents) {
      const result = compareIntents(x, y, now);
      if (result && (!best || result.score > best.score)) best = result;
    }
  return best;
}

function indexKey(intent: MatchIntent, reverse = false): string {
  return intent.kind === 'hall'
    ? `hall:${reverse ? intent.to : intent.from}:${reverse ? intent.from : intent.to}`
    : `${intent.kind}:${intent.entity}`;
}

/** Server-memory inverted entity index: no quadratic all-pairs scan per visitor. */
export class MatchIndex {
  posts = new Map<string, ParsedPost>();
  buckets = new Map<string, Set<string>>();
  constructor(posts: readonly MatchPost[]) {
    for (const post of posts) this.add(parseMatchPost(post));
  }
  add(parsed: ParsedPost): void {
    this.posts.set(parsed.post.id, parsed);
    for (const intent of parsed.intents) {
      const key = indexKey(intent);
      const bucket = this.buckets.get(key) ?? new Set<string>();
      bucket.add(parsed.post.id);
      this.buckets.set(key, bucket);
    }
  }
  candidates(own: readonly ParsedPost[]): Set<string> {
    const result = new Set<string>();
    for (const post of own)
      for (const intent of post.intents)
        for (const id of this.buckets.get(indexKey(intent, true)) ?? [])
          result.add(id);
    return result;
  }
}
export type RankedMatch = PairMatch & { post: MatchPost; ownPostId: string };
export function rankMatches(
  own: readonly ParsedPost[],
  candidates: readonly ParsedPost[],
  now = new Date(),
): RankedMatch[] {
  const rows: RankedMatch[] = [];
  for (const candidate of candidates) {
    let best: RankedMatch | null = null;
    for (const source of own) {
      const match = comparePosts(source, candidate, now);
      if (match && (!best || match.score > best.score))
        best = { ...match, post: candidate.post, ownPostId: source.post.id };
    }
    if (best) rows.push(best);
  }
  return rows.sort(
    (a, b) =>
      b.score - a.score ||
      new Date(b.post.createdAt).getTime() -
        new Date(a.post.createdAt).getTime() ||
      a.post.id.localeCompare(b.post.id),
  );
}
