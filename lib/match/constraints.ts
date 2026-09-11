/**
 * Typed constraint comparisons for already extracted matching facts.
 * These compare already grounded facts; they neither extract text nor prove ownership,
 * exchange eligibility, availability, bundle contents, or permission for partial stays.
 */
export type ConstraintStatus = 'compatible' | 'conflict' | 'unknown';
export interface ConstraintComparison {
  status: ConstraintStatus;
  /** Stable machine-readable explanation, never an invented missing value. */
  reason: string;
}

export type ResidencePeriod =
  | { type: 'academic-year'; startYear: number; endYear: number }
  | {
      type: 'semester';
      year: number;
      semester: 'fall' | 'spring' | 'summer' | 'winter';
    }
  | { type: 'dates'; start: string; end: string };
export type ResidenceRelation = 'equal' | 'covers';
export type RoomType = 'single' | 'double' | 'triple' | 'quadruple' | 'studio';
export type WantedRooms = 'any' | readonly RoomType[];

export type MoneyBasis =
  | 'item'
  | 'bundle'
  | 'person'
  | 'party'
  | 'session'
  | 'hour';
export interface Money {
  amount?: number | null;
  currency?: string | null;
  basis?: MoneyBasis | null;
  scope?: 'asking' | 'maximum' | null;
}
export interface MoneyContext {
  /** Number of items in the SAME complete bundle being priced on both sides. */
  itemQuantity?: number | null;
  /** Total chargeable people in the SAME complete party on both sides. */
  partySize?: number | null;
  /**
   * Explicitly known BILLABLE minutes in the same complete session. The caller must
   * resolve minimum purchases, billing increments and breaks first; this is not an
   * assumption that every desired session duration is billed proportionally.
   */
  billableMinutes?: number | null;
}

// This explicit supported vocabulary is not a default currency or an FX table.
// Additional currencies require deliberate support; a plausible-looking code alone
// (e.g. ZZZ or XXX) must not turn an unknown currency into a confirmed comparison.
export const SUPPORTED_MONEY_CURRENCIES = [
  'HKD',
  'CNY',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'NZD',
  'SGD',
  'TWD',
  'KRW',
  'INR',
  'MYR',
  'THB',
  'IDR',
  'PHP',
  'VND',
  'MOP',
] as const;
const currencies = new Set<string>(SUPPORTED_MONEY_CURRENCIES);
const bases = new Set<string>([
  'item',
  'bundle',
  'person',
  'party',
  'session',
  'hour',
]);
const rooms = new Set<string>([
  'single',
  'double',
  'triple',
  'quadruple',
  'studio',
]);
const semesters = new Set<string>(['fall', 'spring', 'summer', 'winter']);
const absent = (value: unknown) => value === undefined || value === null;
const result = (
  status: ConstraintStatus,
  reason: string,
): ConstraintComparison => ({ status, reason });

/** Reject coercion, arrays, inherited fields and accessors at the input boundary. */
function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === null || prototype === Object.prototype) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === 'string' &&
        'value' in Object.getOwnPropertyDescriptor(value, key)!,
    )
  );
}
function keysWithin(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Reflect.ownKeys(value).every(
    (key) => typeof key === 'string' && allowed.includes(key),
  );
}
function year(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9999
  );
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split('-').map(Number);
  if (!year(y) || m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[m - 1];
}
function validPeriod(value: unknown): value is ResidencePeriod {
  if (!record(value)) return false;
  switch (value.type) {
    case 'academic-year':
      // A single explicitly labelled academic year, not an inferred calendar interval.
      return (
        keysWithin(value, ['type', 'startYear', 'endYear']) &&
        year(value.startYear) &&
        year(value.endYear) &&
        value.endYear === value.startYear + 1
      );
    case 'semester':
      return (
        keysWithin(value, ['type', 'year', 'semester']) &&
        year(value.year) &&
        typeof value.semester === 'string' &&
        semesters.has(value.semester)
      );
    case 'dates':
      return (
        keysWithin(value, ['type', 'start', 'end']) &&
        validDate(value.start) &&
        validDate(value.end) &&
        value.start <= value.end
      );
    default:
      return false;
  }
}

/** Decode only an explicit canonical label; a bare season has no known year. */
export function parseResidenceLabel(label: string | null | undefined): ResidencePeriod | undefined {
  if (typeof label !== 'string') return undefined;
  let value: ResidencePeriod | undefined;
  const semester = /^(fall|spring|summer|winter):(\d{4})$/.exec(label);
  const academic = /^academic:(\d{4})-(\d{4})$/.exec(label);
  const dates = /^dates:(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/.exec(label);
  if (semester) value = { type: 'semester', semester: semester[1] as 'fall' | 'spring' | 'summer' | 'winter', year: Number(semester[2]) };
  else if (academic) value = { type: 'academic-year', startYear: Number(academic[1]), endYear: Number(academic[2]) };
  else if (dates) value = { type: 'dates', start: dates[1], end: dates[2] };
  return validPeriod(value) ? value : undefined;
}

/**
 * Compare the offered period with the required period. Date endpoints are inclusive;
 * a one-day stay is valid. "covers" checks the WHOLE wanted interval, not overlap.
 * Academic-year labels and semester labels have no implied dates or inter-kind
 * mapping. The semester year is an explicit calendar year, not an inferred start
 * year of an academic year. Cross-kind comparisons are unknown even if plausible.
 * Temporal coverage alone does not assert that partial-period exchange is permitted.
 */
export function compareResidencePeriods(
  offered: ResidencePeriod | null | undefined,
  wanted: ResidencePeriod | null | undefined,
  relation: ResidenceRelation = 'covers',
): ConstraintComparison {
  if (relation !== 'equal' && relation !== 'covers')
    return result('unknown', 'invalid-residence-relation');
  if (absent(offered) || absent(wanted))
    return result('unknown', 'missing-residence-period');
  if (!validPeriod(offered)) return result('unknown', 'invalid-offered-period');
  if (!validPeriod(wanted)) return result('unknown', 'invalid-wanted-period');
  if (offered.type !== wanted.type)
    return result('unknown', 'residence-calendar-mapping-required');
  let compatible: boolean;
  if (offered.type === 'dates' && wanted.type === 'dates') {
    compatible =
      relation === 'equal'
        ? offered.start === wanted.start && offered.end === wanted.end
        : offered.start <= wanted.start && offered.end >= wanted.end;
  } else if (
    offered.type === 'academic-year' &&
    wanted.type === 'academic-year'
  ) {
    compatible =
      offered.startYear === wanted.startYear &&
      offered.endYear === wanted.endYear;
  } else if (offered.type === 'semester' && wanted.type === 'semester') {
    compatible =
      offered.year === wanted.year && offered.semester === wanted.semester;
  } else {
    return result('unknown', 'residence-calendar-mapping-required');
  }
  return compatible
    ? result(
        'compatible',
        relation === 'equal'
          ? 'residence-periods-equal'
          : 'residence-period-covered',
      )
    : result(
        'conflict',
        relation === 'equal'
          ? 'residence-periods-differ'
          : 'residence-period-not-covered',
      );
}

/** Explicit "any" accepts any KNOWN supported actual room; it never fills unknown facts. */
export function compareRoomAcceptance(
  actual: RoomType | null | undefined,
  wanted: WantedRooms | null | undefined,
): ConstraintComparison {
  if (absent(actual)) return result('unknown', 'missing-actual-room');
  if (typeof actual !== 'string' || !rooms.has(actual))
    return result('unknown', 'invalid-actual-room');
  if (absent(wanted)) return result('unknown', 'missing-wanted-rooms');
  if (wanted === 'any') return result('compatible', 'any-known-room-accepted');
  if (
    !Array.isArray(wanted) ||
    !wanted.length ||
    !Array.from(wanted).every(
      (room) => typeof room === 'string' && rooms.has(room),
    )
  ) {
    return result('unknown', 'invalid-wanted-rooms');
  }
  return wanted.includes(actual)
    ? result('compatible', 'room-in-accepted-set')
    : result('conflict', 'room-outside-accepted-set');
}

function amount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}
function positiveCount(value: unknown): value is number {
  return amount(value) && Number.isSafeInteger(value) && value > 0;
}
function validMoney(
  value: unknown,
  expectedScope: 'asking' | 'maximum',
): value is Money {
  if (
    !record(value) ||
    !keysWithin(value, ['amount', 'currency', 'basis', 'scope'])
  )
    return false;
  return (
    (absent(value.amount) || amount(value.amount)) &&
    (absent(value.currency) ||
      (typeof value.currency === 'string' && currencies.has(value.currency))) &&
    (absent(value.basis) ||
      (typeof value.basis === 'string' && bases.has(value.basis))) &&
    (absent(value.scope) || value.scope === expectedScope)
  );
}
function validContext(value: unknown): value is MoneyContext {
  if (
    !record(value) ||
    !keysWithin(value, ['itemQuantity', 'partySize', 'billableMinutes'])
  )
    return false;
  return (
    (absent(value.itemQuantity) || positiveCount(value.itemQuantity)) &&
    (absent(value.partySize) || positiveCount(value.partySize)) &&
    (absent(value.billableMinutes) ||
      (amount(value.billableMinutes) && value.billableMinutes > 0))
  );
}

type Fraction = { numerator: bigint; denominator: bigint };
/** Exact arithmetic on the supplied number's decimal representation; no currency rounding. */
function decimal(value: number): Fraction {
  const [coefficient, power = '0'] = value.toString().toLowerCase().split('e');
  const [integer, fractional = ''] = coefficient.split('.');
  const digits = BigInt(integer + fractional);
  const scale = fractional.length - Number(power);
  return scale >= 0
    ? { numerator: digits, denominator: BigInt(10) ** BigInt(scale) }
    : {
        numerator: digits * BigInt(10) ** BigInt(-scale),
        denominator: BigInt(1),
      };
}
function multiply(a: Fraction, b: Fraction): Fraction {
  return {
    numerator: a.numerator * b.numerator,
    denominator: a.denominator * b.denominator,
  };
}
function family(basis: MoneyBasis): 'items' | 'people' | 'time' {
  if (basis === 'item' || basis === 'bundle') return 'items';
  if (basis === 'person' || basis === 'party') return 'people';
  return 'time';
}

/**
 * Does the asking price fit the maximum budget, for the SAME priced transaction?
 * No fee mentioned on either side is unknown, not an assertion that it is free.
 * An explicit zero asking amount fits any known nonnegative budget without a
 * currency/unit conversion. This says nothing about deposits or other conditions.
 * Otherwise missing/different currencies are unknown (there is no FX), and
 * missing units never default to per-item, total, or per-person.
 * Only item↔bundle, person↔party and hour↔session are convertible, with an explicit
 * shared quantity/party/billable duration. A fixed bundle/session is never prorated.
 * Same-basis inputs compare their stated rates directly. Validate quantity, contents,
 * availability and other non-price constraints separately before calling a match.
 * Invalid data yields unknown rather than throwing or becoming a definite conflict.
 */
export function compareMoney(
  asking: Money | null | undefined,
  maximum: Money | null | undefined,
  context: MoneyContext = {},
): ConstraintComparison {
  if (absent(asking) || absent(maximum))
    return result('unknown', 'missing-money');
  if (!validMoney(asking, 'asking'))
    return result('unknown', 'invalid-asking-money');
  if (!validMoney(maximum, 'maximum'))
    return result('unknown', 'invalid-maximum-money');
  if (!validContext(context)) return result('unknown', 'invalid-money-context');
  if (absent(asking.amount) || absent(maximum.amount))
    return result('unknown', 'missing-money-amount');
  const askingAmount = asking.amount!;
  const maximumAmount = maximum.amount!;
  if (askingAmount === 0 && maximumAmount === 0)
    return result('compatible', 'both-explicitly-zero');
  if (askingAmount === 0)
    return result('compatible', 'explicit-free-price-within-budget');
  if (!asking.currency || !maximum.currency)
    return result('unknown', 'missing-money-currency');
  if (asking.currency !== maximum.currency)
    return result('unknown', 'currency-conversion-required');
  if (!asking.basis || !maximum.basis)
    return result('unknown', 'missing-money-basis');
  let offeredValue = decimal(askingAmount);
  let budgetValue = decimal(maximumAmount);
  let converted = false;
  if (asking.basis !== maximum.basis) {
    const group = family(asking.basis);
    if (group !== family(maximum.basis))
      return result('unknown', 'incomparable-money-bases');
    const count =
      group === 'items'
        ? context.itemQuantity
        : group === 'people'
          ? context.partySize
          : context.billableMinutes;
    if (absent(count)) {
      return result(
        'unknown',
        group === 'items'
          ? 'missing-item-quantity'
          : group === 'people'
            ? 'missing-party-size'
            : 'missing-billable-duration',
      );
    }
    const factor = decimal(count!);
    if (group === 'time') factor.denominator *= BigInt(60);
    const granularBasis =
      group === 'items' ? 'item' : group === 'people' ? 'person' : 'hour';
    if (asking.basis === granularBasis)
      offeredValue = multiply(offeredValue, factor);
    if (maximum.basis === granularBasis)
      budgetValue = multiply(budgetValue, factor);
    converted = true;
  }
  const withinBudget =
    offeredValue.numerator * budgetValue.denominator <=
    budgetValue.numerator * offeredValue.denominator;
  return withinBudget
    ? result(
        'compatible',
        converted ? 'converted-price-within-budget' : 'price-within-budget',
      )
    : result(
        'conflict',
        converted ? 'converted-price-exceeds-budget' : 'price-exceeds-budget',
      );
}
