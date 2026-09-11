import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareMoney,
  compareResidencePeriods,
  compareRoomAcceptance,
} from '../../lib/match/constraints.ts';

const dates = (start, end) => ({ type: 'dates', start, end });
const academic = (startYear, endYear = startYear + 1) => ({
  type: 'academic-year',
  startYear,
  endYear,
});
const semester = (year, semester = 'fall') => ({
  type: 'semester',
  year,
  semester,
});
const money = (amount, basis = 'item', currency = 'HKD') => ({
  amount,
  currency,
  basis,
});
const status = (value, expected, message) => {
  assert.equal(value.status, expected, message ?? value.reason);
  assert.equal(typeof value.reason, 'string');
  assert.ok(value.reason.length > 0);
};

test('academic-year and semester labels compare their complete explicit labels', () => {
  for (const relation of ['equal', 'covers']) {
    status(
      compareResidencePeriods(academic(2026), academic(2026), relation),
      'compatible',
    );
    status(
      compareResidencePeriods(academic(2026), academic(2027), relation),
      'conflict',
    );
    status(
      compareResidencePeriods(semester(2026), semester(2026), relation),
      'compatible',
    );
    status(
      compareResidencePeriods(
        semester(2026),
        semester(2026, 'spring'),
        relation,
      ),
      'conflict',
    );
    status(
      compareResidencePeriods(semester(2026), semester(2027), relation),
      'conflict',
    );
  }
});

test('date equality keeps the precise end date and differs from coverage', () => {
  const offered = dates('2026-09-01', '2027-08-31');
  const wanted = dates('2026-09-01', '2027-05-31');
  status(compareResidencePeriods(offered, wanted), 'compatible');
  status(compareResidencePeriods(wanted, offered), 'conflict');
  status(compareResidencePeriods(offered, wanted, 'equal'), 'conflict');
  status(
    compareResidencePeriods(offered, { ...offered }, 'equal'),
    'compatible',
  );
});

test('coverage requires the entire inclusive wanted stay, not a shared day', () => {
  const offered = dates('2026-09-11', '2026-09-20');
  for (const wanted of [
    dates('2026-09-11', '2026-09-20'),
    dates('2026-09-11', '2026-09-11'),
    dates('2026-09-20', '2026-09-20'),
    dates('2026-09-12', '2026-09-19'),
  ])
    status(compareResidencePeriods(offered, wanted), 'compatible');
  for (const wanted of [
    dates('2026-09-10', '2026-09-11'),
    dates('2026-09-20', '2026-09-21'),
    dates('2026-09-10', '2026-09-21'),
    dates('2027-09-11', '2027-09-20'),
  ])
    status(compareResidencePeriods(offered, wanted), 'conflict');
});

test('cross-kind residence comparisons require a real calendar mapping', () => {
  const periods = [
    academic(2026),
    semester(2026),
    dates('2026-09-01', '2027-08-31'),
  ];
  for (const a of periods)
    for (const b of periods) {
      if (a.type !== b.type) {
        for (const relation of ['covers', 'equal']) {
          assert.deepEqual(compareResidencePeriods(a, b, relation), {
            status: 'unknown',
            reason: 'residence-calendar-mapping-required',
          });
        }
      }
    }
  // Do not equate academic 2026/27 with fall 2026, or manufacture a Sep–Aug year.
  status(
    compareResidencePeriods(academic(2026), dates('2026-09-01', '2027-08-31')),
    'unknown',
  );
});

test('Gregorian date validation handles leap days and rejects rollover/coercion', () => {
  for (const value of [
    '2024-02-29',
    '2000-02-29',
    '0001-01-01',
    '9999-12-31',
  ]) {
    const period = dates(value, value);
    status(compareResidencePeriods(period, period), 'compatible', value);
  }
  for (const value of [
    '2026-02-29',
    '1900-02-29',
    '2100-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '0000-01-01',
    '2026-9-01',
    '26-09-01',
    '2026-09-11T00:00:00Z',
    ' 2026-09-11',
    '2026-09-11 ',
    '',
    20260911,
    true,
    null,
  ])
    status(
      compareResidencePeriods(
        dates(value, value),
        dates('2026-09-11', '2026-09-11'),
      ),
      'unknown',
      String(value),
    );
});

test('invalid/missing periods do not become known conflicts or silently repair labels', () => {
  const valid = academic(2026);
  for (const invalid of [
    undefined,
    null,
    {},
    [],
    '2026/27',
    { ...valid, startYear: '2026' },
    academic(NaN),
    academic(Infinity),
    academic(2026.5),
    academic(0),
    academic(9999),
    academic(2026, 2026),
    academic(2026, 27),
    academic(2026, 2028),
    semester(2026, 'autumn'),
    semester(2026, ''),
    semester('2026'),
    dates('2026-12-01', '2026-09-01'),
    { type: 'dates', start: '2026-09-01' },
    { ...valid, guessed: true },
    new Date(),
    Object.create({ ...valid }),
  ]) {
    status(compareResidencePeriods(invalid, valid), 'unknown');
    status(compareResidencePeriods(valid, invalid), 'unknown');
  }
  status(compareResidencePeriods(valid, valid, 'overlaps'), 'unknown');
});

test('equality is symmetric and shorter offers cannot repair insufficient coverage', () => {
  const spans = [];
  for (let start = 10; start <= 12; start++)
    for (let end = start; end <= 15; end++) {
      spans.push(dates(`2026-09-${start}`, `2026-09-${end}`));
    }
  for (const a of spans)
    for (const b of spans) {
      assert.deepEqual(
        compareResidencePeriods(a, b, 'equal'),
        compareResidencePeriods(b, a, 'equal'),
      );
      const computed = compareResidencePeriods(a, b).status;
      assert.equal(
        computed,
        a.start <= b.start && a.end >= b.end ? 'compatible' : 'conflict',
      );
      if (computed === 'conflict') {
        for (const smaller of spans.filter(
          (s) => s.start >= a.start && s.end <= a.end,
        )) {
          status(compareResidencePeriods(smaller, b), 'conflict');
        }
      }
    }
});

test('explicit room any and accepted sets retain unknown actual rooms', () => {
  const sparseRooms = [];
  sparseRooms.length = 2;
  for (const room of ['single', 'double', 'triple', 'quadruple', 'studio']) {
    status(compareRoomAcceptance(room, 'any'), 'compatible');
    status(compareRoomAcceptance(room, [room]), 'compatible');
  }
  status(compareRoomAcceptance('single', ['single', 'double']), 'compatible');
  status(compareRoomAcceptance('single', ['double', 'single']), 'compatible');
  status(compareRoomAcceptance('single', ['single', 'single']), 'compatible');
  status(compareRoomAcceptance('triple', ['single', 'double']), 'conflict');
  for (const actual of [
    undefined,
    null,
    '',
    'any',
    'unknown',
    'Single',
    true,
    1,
    'unrecognized',
  ]) {
    status(compareRoomAcceptance(actual, 'any'), 'unknown');
    status(compareRoomAcceptance(actual, ['single']), 'unknown');
  }
  for (const wanted of [
    undefined,
    null,
    [],
    sparseRooms,
    'single',
    ['any'],
    ['single', null],
    ['single', 'unrecognized'],
  ]) {
    status(compareRoomAcceptance('single', wanted), 'unknown');
  }
});

test('same-basis explicit money compares asking price with an inclusive budget', () => {
  for (const basis of [
    'item',
    'bundle',
    'person',
    'party',
    'session',
    'hour',
  ]) {
    status(compareMoney(money(100, basis), money(100, basis)), 'compatible');
    status(compareMoney(money(99.99, basis), money(100, basis)), 'compatible');
    status(compareMoney(money(100.01, basis), money(100, basis)), 'conflict');
    status(compareMoney(money(0, basis), money(100, basis)), 'compatible');
    status(compareMoney(money(1, basis), money(0, basis)), 'conflict');
  }
});

test('explicit zero is not the same as an absent price', () => {
  assert.deepEqual(compareMoney({ amount: 0 }, { amount: 0 }), {
    status: 'compatible',
    reason: 'both-explicitly-zero',
  });
  status(
    compareMoney(
      { amount: 0, currency: 'HKD' },
      { amount: 0, currency: 'USD' },
    ),
    'compatible',
  );
  status(compareMoney(money(0, 'person'), money(0, 'hour')), 'compatible');
  for (const unknown of [
    {},
    { amount: undefined },
    { amount: null },
    undefined,
    null,
  ]) {
    status(compareMoney(unknown, unknown), 'unknown');
    status(compareMoney(unknown, { amount: 0 }), 'unknown');
    status(compareMoney({ amount: 0 }, unknown), 'unknown');
  }
  // An explicit free offer fits a known budget; a paid offer still needs units.
  status(compareMoney({ amount: 0 }, { amount: 100 }), 'compatible');
  status(compareMoney({ amount: 100 }, { amount: 0 }), 'unknown');
});

test('explicit free supply fits any valid known budget without assuming currency or units', () => {
  assert.deepEqual(compareMoney({ amount: 0 }, money(100)), {
    status: 'compatible',
    reason: 'explicit-free-price-within-budget',
  });
  for (const offer of [
    { amount: 0 },
    { amount: 0, currency: null, basis: null },
    { amount: 0, currency: 'USD' },
    { amount: 0, basis: 'hour' },
    { amount: 0, currency: 'CNY', basis: 'person', scope: 'asking' },
  ]) {
    for (const budget of [
      { amount: 0 },
      { amount: Number.MIN_VALUE },
      { amount: 100 },
      { amount: 100, currency: 'HKD' },
      { amount: 100, basis: 'bundle' },
      { amount: 100, currency: 'HKD', basis: 'session', scope: 'maximum' },
      { amount: Number.MAX_SAFE_INTEGER },
    ])
      status(compareMoney(offer, budget), 'compatible');
  }
  // The zero branch does not infer free supply from a free-only budget.
  status(compareMoney({ amount: 1 }, money(0)), 'unknown');
  status(compareMoney(money(1), money(0)), 'conflict');
});

test('free supply still validates amounts, explicit units, roles and context first', () => {
  for (const budget of [
    {},
    { amount: null },
    { amount: undefined },
    { amount: -1 },
    { amount: NaN },
    { amount: Infinity },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { amount: '100' },
    { amount: true },
    { amount: 100, basis: 'total' },
    { amount: 100, currency: '$' },
    { amount: 100, scope: 'asking' },
    { amount: 100, fabricated: true },
    null,
    undefined,
  ])
    status(compareMoney({ amount: 0 }, budget), 'unknown');
  for (const offer of [
    { amount: '0' },
    { amount: false },
    { amount: null },
    { amount: -1 },
    { amount: 0, currency: '$' },
    { amount: 0, basis: 'unit' },
    { amount: 0, scope: 'maximum' },
    { amount: 0, fabricated: true },
  ])
    status(compareMoney(offer, money(100)), 'unknown');
  for (const context of [
    { itemQuantity: 0 },
    { partySize: -1 },
    { billableMinutes: '60' },
    null,
  ]) {
    status(compareMoney({ amount: 0 }, money(100), context), 'unknown');
  }
});

test('currency is explicit: no symbols, locale defaults or implicit FX', () => {
  for (const currency of [undefined, null]) {
    status(
      compareMoney({ amount: 10, basis: 'item', currency }, money(20)),
      'unknown',
    );
    status(
      compareMoney(money(10), { amount: 20, basis: 'item', currency }),
      'unknown',
    );
  }
  for (const currency of [
    '$',
    'HK$',
    'hkd',
    ' HKD',
    'ZZZ',
    'XXX',
    '',
    344,
    true,
  ]) {
    status(
      compareMoney(money(10, 'item', currency), money(20, 'item', currency)),
      'unknown',
    );
  }
  for (const currency of [
    'HKD',
    'CNY',
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CAD',
    'SGD',
  ]) {
    status(
      compareMoney(money(10, 'item', currency), money(20, 'item', currency)),
      'compatible',
    );
  }
  status(
    compareMoney(money(10, 'item', 'USD'), money(1000, 'item', 'HKD')),
    'unknown',
  );
  status(
    compareMoney(money(1000, 'item', 'HKD'), money(10, 'item', 'USD')),
    'unknown',
  );
});

test('no missing or ambiguous price basis defaults to item, bundle or person', () => {
  for (const basis of [
    undefined,
    null,
    '',
    'unit',
    'total',
    'seat',
    'per person',
    true,
    1,
  ]) {
    const value = { amount: 10, currency: 'HKD', basis };
    status(compareMoney(value, value), 'unknown');
    status(compareMoney(value, money(20)), 'unknown');
    status(compareMoney(money(5), value), 'unknown');
  }
  for (const a of ['item', 'bundle', 'person', 'party', 'session', 'hour']) {
    for (const b of ['item', 'bundle', 'person', 'party', 'session', 'hour']) {
      const groups = [
        ['item', 'bundle'],
        ['person', 'party'],
        ['session', 'hour'],
      ];
      if (!groups.some((g) => g.includes(a) && g.includes(b))) {
        status(
          compareMoney(money(5, a), money(100, b), {
            itemQuantity: 2,
            partySize: 2,
            billableMinutes: 60,
          }),
          'unknown',
        );
      }
    }
  }
});

test('item/bundle conversion uses the known whole-bundle quantity in both directions', () => {
  status(
    compareMoney(money(30, 'item'), money(100, 'bundle'), { itemQuantity: 3 }),
    'compatible',
  );
  status(
    compareMoney(money(30, 'item'), money(100, 'bundle'), { itemQuantity: 4 }),
    'conflict',
  );
  status(
    compareMoney(money(90, 'bundle'), money(30, 'item'), { itemQuantity: 3 }),
    'compatible',
  );
  status(
    compareMoney(money(91, 'bundle'), money(30, 'item'), { itemQuantity: 3 }),
    'conflict',
  );
  status(compareMoney(money(30, 'item'), money(100, 'bundle')), 'unknown');
  status(compareMoney(money(90, 'bundle'), money(30, 'item')), 'unknown');
  status(
    compareMoney(money(90, 'bundle'), money(30, 'item'), { partySize: 3 }),
    'unknown',
  );
});

test('per-person and whole-party fares do not assume a single passenger', () => {
  status(
    compareMoney(money(60, 'person'), money(180, 'party'), { partySize: 3 }),
    'compatible',
  );
  status(
    compareMoney(money(60, 'person'), money(180, 'party'), { partySize: 4 }),
    'conflict',
  );
  status(
    compareMoney(money(180, 'party'), money(60, 'person'), { partySize: 3 }),
    'compatible',
  );
  status(
    compareMoney(money(181, 'party'), money(60, 'person'), { partySize: 3 }),
    'conflict',
  );
  status(compareMoney(money(60, 'person'), money(180, 'party')), 'unknown');
  status(
    compareMoney(money(180, 'party'), money(60, 'person'), { itemQuantity: 3 }),
    'unknown',
  );
});

test('hour/session comparisons need known billable duration, including minimum purchases', () => {
  status(
    compareMoney(money(120, 'hour'), money(180, 'session'), {
      billableMinutes: 90,
    }),
    'compatible',
  );
  status(
    compareMoney(money(120, 'hour'), money(179.99, 'session'), {
      billableMinutes: 90,
    }),
    'conflict',
  );
  status(
    compareMoney(money(180, 'session'), money(120, 'hour'), {
      billableMinutes: 90,
    }),
    'compatible',
  );
  status(
    compareMoney(money(181, 'session'), money(120, 'hour'), {
      billableMinutes: 90,
    }),
    'conflict',
  );
  // A 90-minute meeting with a confirmed two-hour minimum must pass 120 billed minutes.
  status(
    compareMoney(money(120, 'hour'), money(180, 'session'), {
      billableMinutes: 120,
    }),
    'conflict',
  );
  status(compareMoney(money(120, 'hour'), money(180, 'session')), 'unknown');
  status(compareMoney(money(180, 'session'), money(120, 'hour')), 'unknown');
  status(
    compareMoney(money(120, 'hour'), money(180, 'session'), {
      durationMinutes: 90,
    }),
    'unknown',
  );
  status(
    compareMoney(money(120, 'hour'), money(1, 'session'), {
      billableMinutes: 0.5,
    }),
    'compatible',
  );
});

test('decimal multiplication compares exact supplied decimals without currency rounding', () => {
  status(
    compareMoney(money(0.1, 'item'), money(0.3, 'bundle'), { itemQuantity: 3 }),
    'compatible',
  );
  status(
    compareMoney(money(0.3, 'bundle'), money(0.1, 'item'), { itemQuantity: 3 }),
    'compatible',
  );
  status(
    compareMoney(money(19.99, 'item'), money(59.97, 'bundle'), {
      itemQuantity: 3,
    }),
    'compatible',
  );
  status(
    compareMoney(money(19.99, 'item'), money(59.96, 'bundle'), {
      itemQuantity: 3,
    }),
    'conflict',
  );
  status(
    compareMoney(money(0.1, 'hour'), money(0.15, 'session'), {
      billableMinutes: 90,
    }),
    'compatible',
  );
  status(
    compareMoney(money(1e-7, 'item'), money(3e-7, 'bundle'), {
      itemQuantity: 3,
    }),
    'compatible',
  );
  status(
    compareMoney(money(1, 'hour'), money(0.02, 'session'), {
      billableMinutes: 1,
    }),
    'compatible',
  );
  status(
    compareMoney(money(1, 'hour'), money(0.01, 'session'), {
      billableMinutes: 1,
    }),
    'conflict',
  );
  status(
    compareMoney(money(Number.MIN_VALUE, 'item'), money(0, 'bundle'), {
      itemQuantity: 1,
    }),
    'conflict',
  );
  status(
    compareMoney(
      money(Number.MAX_SAFE_INTEGER, 'item'),
      money(Number.MAX_SAFE_INTEGER, 'bundle'),
      {
        itemQuantity: Number.MAX_SAFE_INTEGER,
      },
    ),
    'conflict',
  );
  // Do not introduce an epsilon that silently erases an explicitly supplied higher amount.
  status(compareMoney(money(0.1 + 0.2), money(0.3)), 'conflict');
});

test('strict money/count/duration validation rejects coercion and unsafe numeric values', () => {
  for (const invalid of [
    -1,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '0',
    '100',
    true,
    false,
    {},
    [],
  ]) {
    status(compareMoney(money(invalid), money(100)), 'unknown');
    status(compareMoney(money(100), money(invalid)), 'unknown');
  }
  for (const key of ['itemQuantity', 'partySize']) {
    for (const invalid of [
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      '2',
      true,
      {},
    ]) {
      status(
        compareMoney(money(1, 'item'), money(10, 'bundle'), { [key]: invalid }),
        'unknown',
      );
    }
  }
  for (const invalid of [
    0,
    -1,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '90',
    true,
    {},
  ]) {
    status(
      compareMoney(money(1, 'hour'), money(10, 'session'), {
        billableMinutes: invalid,
      }),
      'unknown',
    );
  }
  for (const context of [null, [], 'one', Object.create({ itemQuantity: 1 })]) {
    status(compareMoney(money(1), money(2), context), 'unknown');
  }
  status(
    compareMoney(money(1, 'item'), money(10, 'bundle'), { itemQuantity: null }),
    'unknown',
  );
  // Malformed explicit units do not get laundered by the zero-price exception.
  status(compareMoney({ amount: 0, basis: 'total' }, { amount: 0 }), 'unknown');
});

test('asking and maximum roles are directional and optionally checked explicitly', () => {
  status(
    compareMoney(
      { ...money(10), scope: 'asking' },
      { ...money(20), scope: 'maximum' },
    ),
    'compatible',
  );
  status(
    compareMoney({ ...money(10), scope: 'maximum' }, money(20)),
    'unknown',
  );
  status(compareMoney(money(10), { ...money(20), scope: 'asking' }), 'unknown');
  status(compareMoney(money(10), money(20)), 'compatible');
  status(compareMoney(money(20), money(10)), 'conflict');
});

test('unknown or invalid input records never coerce or evaluate getters', () => {
  const getter = Object.defineProperty({}, 'amount', {
    enumerable: true,
    get() {
      throw new Error('must not execute');
    },
  });
  const periodGetter = Object.defineProperty({}, 'type', {
    enumerable: true,
    get() {
      throw new Error('must not execute');
    },
  });
  status(compareMoney(getter, money(100)), 'unknown');
  status(compareResidencePeriods(periodGetter, academic(2026)), 'unknown');
  for (const invalid of [
    [],
    true,
    0,
    '100 HKD',
    Object.create(money(100)),
    { ...money(100), assumed: true },
  ]) {
    status(compareMoney(invalid, money(100)), 'unknown');
  }
  const plain = Object.assign(Object.create(null), money(100));
  status(compareMoney(plain, money(100)), 'compatible');
});

test('removing known facts cannot create a confirmed match', () => {
  for (const field of ['amount', 'currency', 'basis']) {
    const value = money(50);
    delete value[field];
    status(compareMoney(value, money(100)), 'unknown');
    status(compareMoney(money(50), value), 'unknown');
  }
  const asking = money(20, 'person');
  const maximum = money(50, 'party');
  status(compareMoney(asking, maximum, { partySize: 2 }), 'compatible');
  status(compareMoney(asking, maximum), 'unknown');
  status(
    compareResidencePeriods(
      dates('2026-09-01', '2027-08-31'),
      dates('2026-09-02', '2027-08-30'),
    ),
    'compatible',
  );
  status(
    compareResidencePeriods(undefined, dates('2026-09-02', '2027-08-30')),
    'unknown',
  );
  status(compareRoomAcceptance('single', 'any'), 'compatible');
  status(compareRoomAcceptance(undefined, 'any'), 'unknown');
});

test('increasing rates/counts and decreasing budgets cannot improve affordability', () => {
  for (let amount = 1; amount <= 10; amount++)
    for (let quantity = 1; quantity <= 5; quantity++) {
      const budget = 20;
      const expected = amount * quantity <= budget ? 'compatible' : 'conflict';
      status(
        compareMoney(money(amount, 'item'), money(budget, 'bundle'), {
          itemQuantity: quantity,
        }),
        expected,
      );
      if (expected === 'conflict') {
        status(
          compareMoney(money(amount + 1, 'item'), money(budget, 'bundle'), {
            itemQuantity: quantity,
          }),
          'conflict',
        );
        status(
          compareMoney(money(amount, 'item'), money(budget - 1, 'bundle'), {
            itemQuantity: quantity,
          }),
          'conflict',
        );
        status(
          compareMoney(money(amount, 'item'), money(budget, 'bundle'), {
            itemQuantity: quantity + 1,
          }),
          'conflict',
        );
      }
    }
});

test('comparators do not mutate grounded inputs or contexts', () => {
  const offered = Object.freeze(dates('2026-09-01', '2027-08-31'));
  const wanted = Object.freeze(dates('2026-09-02', '2027-08-30'));
  status(compareResidencePeriods(offered, wanted), 'compatible');
  status(
    compareRoomAcceptance('single', Object.freeze(['single', 'double'])),
    'compatible',
  );
  status(
    compareMoney(
      Object.freeze(money(0.1, 'item')),
      Object.freeze(money(0.3, 'bundle')),
      Object.freeze({ itemQuantity: 3 }),
    ),
    'compatible',
  );
});
