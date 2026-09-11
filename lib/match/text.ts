import type { MatchPost } from './types.ts';

export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole-request withdrawal only; local negation belongs to each intent parser. */
export function isCancelled(value: string): boolean {
  const text = normalizeText(value);
  return /\b(?:cancelled|canceled|no longer (?:need|looking|available|selling)|already (?:sold|found|sorted)|sold out|request withdrawn)\b|(?:已取消|取消了|唔使喇|唔使啦|不用了|不需要了|已出掉|已售出|已搵到|已找到)/u.test(
    text,
  );
}

type Schedule = {
  date?: string;
  minute?: number;
  endMinute?: number;
  ambiguous: boolean;
};
const pad = (n: number) => String(n).padStart(2, '0');
function validDate(y: number, m: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : undefined;
}
function shiftedDay(anchor: Date, days: number): string {
  return new Date(anchor.getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

/** Calendar phrases are anchored to posting time in Hong Kong, not request time. */
export function extractSchedule(post: MatchPost): Schedule {
  const text = normalizeText(`${post.title}\n${post.body}`)
    .replace(/\bnot\b[^.!?]*\d{1,2}:\d{2}[^.!?]*\banymore\b[.!?]?/g, '')
    .replace(
      /(?:not|不是|唔係)\s*(?:at\s*)?\d{1,2}:\d{2}\s*(?=but|而是|而係)/g,
      '',
    );
  const original = new Date(post.createdAt);
  if (!Number.isFinite(original.getTime())) return { ambiguous: true };
  const anchor = new Date(original.getTime() + 8 * 3600000);
  const year = anchor.getUTCFullYear();
  const dates = new Set<string>();
  let invalid = false;
  const add = (date: string | undefined) => {
    if (date) dates.add(date);
    else invalid = true;
  };
  // A consumed calendar fragment cannot also be reinterpreted as another date.
  // In "12 Sep 11:00", Sep belongs to the 12th; 11 is the appointment hour.
  let calendarText = text;
  const consumeDates = (
    pattern: RegExp,
    consume: (match: RegExpMatchArray) => void,
  ) => {
    calendarText = calendarText.replace(pattern, (...args: unknown[]) => {
      const groups = args.slice(0, -2) as string[];
      const match = Object.assign(groups, {
        index: args.at(-2) as number,
        input: text,
      }) as RegExpMatchArray;
      consume(match);
      return ' '.repeat(groups[0].length);
    });
  };
  consumeDates(/(?<!\d)(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/g, (m) =>
    add(validDate(+m[1], +m[2], +m[3])),
  );
  consumeDates(/(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})[日号號]?/g, (m) =>
    add(validDate(+(m[1] || year), +m[2], +m[3])),
  );
  const monthNames = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  const monthPattern =
    'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  consumeDates(
    new RegExp(
      `(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s*(${monthPattern})\\.?(?:\\s*(20\\d{2}))?(?![a-z])`,
      'g',
    ),
    (m) =>
      add(
        validDate(
          +(m[3] || year),
          monthNames.indexOf(m[2].slice(0, 3)) + 1,
          +m[1],
        ),
      ),
  );
  consumeDates(
    new RegExp(
      `(?<![a-z\\d])(${monthPattern})\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?(?![\\d:])`,
      'g',
    ),
    (m) =>
      add(
        validDate(
          +(m[3] || year),
          monthNames.indexOf(m[1].slice(0, 3)) + 1,
          +m[2],
        ),
      ),
  );
  consumeDates(/(?<![\d月])(\d{1,2})[号號](?!\d)/g, (m) => {
    if (
      /(?:[场場台桌房楼樓室]|court|table|room)\s*$/.test(
        text.slice(Math.max(0, m.index! - 12), m.index),
      )
    )
      return;
    add(validDate(year, anchor.getUTCMonth() + 1, +m[1]));
  });
  // Bare numeric dates use local day/month only when the month is unambiguous.
  consumeDates(/(?<![\d/-])(\d{1,2})\/(\d{1,2})(?![\d/-])/g, (m) => {
    if (+m[1] > 12) add(validDate(year, +m[2], +m[1]));
    else invalid = true;
  });
  const relative: Array<[RegExp, number]> = [
    [/\bday after tomorrow\b|后天|後天/gu, 2],
    [/\b(?:tomorrow|tmr|tmrw)(?![a-z])|明天|明晚|聽日|听日/gu, 1],
    [/\b(?:today|tonight|this evening)(?![a-z])|今天|今晚|今日/gu, 0],
  ];
  const relativeText = text.replace(/day after tomorrow/g, '后天');
  for (const [pattern, days] of relative)
    if (pattern.test(relativeText)) add(shiftedDay(anchor, days));
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const calendarDates = [...dates];
  function addWeekday(
    day: number,
    scope: string | undefined,
    index: number,
    width: number,
  ) {
    const before = text.slice(Math.max(0, index - 35), index);
    const after = text.slice(index + width, index + width + 25);
    if (
      /(?:\b(?:not|no|except|cannot do|unavailable|impossible)\s+|不(?:是|能|要)|唔(?:係|得))$/.test(
        before,
      ) ||
      /^\s*(?:unavailable|impossible|没空|冇空|不行)/.test(after)
    )
      return;
    if (calendarDates.length) {
      if (
        calendarDates.length === 1 &&
        new Date(`${calendarDates[0]}T00:00:00Z`).getUTCDay() !== day
      )
        invalid = true;
      return;
    }
    const current = (anchor.getUTCDay() + 6) % 7;
    const requested = (day + 6) % 7;
    const delta =
      scope === 'next' || scope === '下'
        ? requested - current + 7
        : scope === 'this' || scope === '本' || scope === '这' || scope === '這'
          ? requested - current
          : (day - anchor.getUTCDay() + 7) % 7;
    add(shiftedDay(anchor, delta));
  }
  for (const m of text.matchAll(
    /\b(?:(this|next)\s+)?(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)(?![a-z])/g,
  ))
    addWeekday(weekdays.indexOf(m[2].slice(0, 3)), m[1], m.index!, m[0].length);
  for (const m of text.matchAll(
    /(下|本|这|這)?(?:周|週|星期)([一二三四五六日天])/gu,
  ))
    addWeekday(
      '日一二三四五六'.indexOf(m[2].replace('天', '日')),
      m[1],
      m.index!,
      m[0].length,
    );
  let timeText = calendarText.replace(
    /\b(?:utc|gmt)\s*\+0?8(?::00)?\b/g,
    (value) => ' '.repeat(value.length),
  );
  const times: number[] = [];
  let explicitRange: [number, number] | undefined;
  // Preserve intervals as intervals, including compact multilingual hour ranges.
  timeText = timeText.replace(
    /(?<![\d:])(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|[点點時时])?\s*(?:-|–|—|to|至|到)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|[点點時时])?/g,
    (whole, h1, m1, p1, h2, m2, p2, offset) => {
      const before = text.slice(Math.max(0, offset - 18), offset);
      if (
        !m1 &&
        !m2 &&
        !p1 &&
        !p2 &&
        !/(?:[日号號晚天]|sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|at|from|today|tomorrow|tmr|上午|下午|晚上|早上|傍晚)\s*$/i.test(
          before,
        )
      )
        return whole;
      const contextPeriod = before.match(
        /(上午|下午|晚上|早上|傍晚|晚)\s*$/,
      )?.[1];
      const firstPeriod = /[ap]/.test(p1 || '')
        ? p1
        : /[ap]/.test(p2 || '')
          ? p2
          : contextPeriod;
      const lastPeriod = /[ap]/.test(p2 || '')
        ? p2
        : /[ap]/.test(p1 || '')
          ? p1
          : contextPeriod;
      const hour = (h: number, period?: string) =>
        period && h <= 12
          ? (h % 12) + (/p|下午|晚上|傍晚|晚/.test(period) ? 12 : 0)
          : h;
      const start = hour(+h1, firstPeriod) * 60 + +(m1 || 0),
        end = hour(+h2, lastPeriod) * 60 + +(m2 || 0);
      if (
        +h1 >= 24 ||
        +h2 >= 24 ||
        +(m1 || 0) >= 60 ||
        +(m2 || 0) >= 60 ||
        end < start ||
        (explicitRange &&
          (explicitRange[0] !== start || explicitRange[1] !== end))
      )
        invalid = true;
      else explicitRange = [start, end];
      return ' '.repeat(whole.length);
    },
  );
  const addTime = (h: number, m: number, period?: string) => {
    if (period && h >= 1 && h <= 12)
      h = (h % 12) + (/p|下午|晚上|晚|傍晚|中午/.test(period) ? 12 : 0);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) times.push(h * 60 + m);
    else invalid = true;
  };
  const colon = /(?<![\d:])(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?(?!\d)/g;
  for (const match of timeText.matchAll(colon)) {
    const before = text.slice(Math.max(0, match.index! - 8), match.index);
    const period =
      match[3] || before.match(/(上午|早上|下午|晚上|傍晚)\s*$/)?.[1];
    addTime(+match[1], +match[2], period);
  }
  for (const match of timeText.matchAll(
    /(?<![\d:])(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/g,
  ))
    addTime(+match[1], 0, match[2]);
  for (const match of timeText.matchAll(
    /(上午|早上|下午|晚上|傍晚|晚|凌晨|午夜|中午)?\s*(\d{1,2}|[一二三四五六七八九十两兩]+)[点點時时](半|\d{1,2}分?)?/gu,
  )) {
    const chinese = (v: string) =>
      /^\d+$/.test(v)
        ? +v
        : v === '十'
          ? 10
          : v.startsWith('十')
            ? 10 + '一二三四五六七八九'.indexOf(v.slice(1)) + 1
            : v === '两' || v === '兩'
              ? 2
              : '一二三四五六七八九'.indexOf(v) + 1;
    if (!match[1] && chinese(match[2]) < 12) {
      invalid = true;
      continue;
    }
    addTime(
      chinese(match[2]),
      match[3] === '半' ? 30 : parseInt(match[3] || '0'),
      match[1],
    );
  }
  if (/\b(?:noon|midday)\b|中午(?:十二[点點]|12[点點])?/.test(timeText))
    times.push(720);
  if (/\bmidnight\b|午夜(?:十二[点點]|12[点點])?/.test(timeText)) times.push(0);
  if (explicitRange) times.push(...explicitRange);
  const unique = [...new Set(times)];
  const isRange = unique.length === 2 && Boolean(explicitRange);
  const uncertainTimezone =
    /(?:time\s*zones?|timezone|时区|時區).{0,100}(?:not decided|undecided|unknown|unresolved|need to confirm|未定|没定|未[确確]定)|(?:not decided|undecided|unknown|unresolved|未定|没定|未[确確]定).{0,100}(?:time\s*zones?|timezone|时区|時區)|(?:hong kong|香港).{0,50}(?:or|还是|還是|也可能).{0,50}(?:time|[时時][间間])|\b(?:est|edt|pst|pdt)(?![a-z])|\b(?:gmt|utc)(?![a-z])(?!\s*\+0?8(?::00)?\b)|(?:new york|london|new zealand|纽约|紐約|伦敦|倫敦).{0,6}(?:time|[时時][间間])/.test(
      text,
    );
  const ambiguous =
    uncertainTimezone ||
    invalid ||
    dates.size > 1 ||
    (unique.length > 1 && !isRange) ||
    /\b(?:sometime|maybe (?:tomorrow|next)|next week)\b|改天|迟啲|遲啲|有空再约|有空再約/u.test(
      text,
    );
  return {
    date: dates.size === 1 ? [...dates][0] : undefined,
    minute:
      !ambiguous && unique.length
        ? isRange
          ? Math.min(...unique)
          : unique[0]
        : undefined,
    endMinute: !ambiguous && isRange ? Math.max(...unique) : undefined,
    ambiguous,
  };
}

/** Explicit deadlines/only-windows must not receive the default loose time tolerance. */
export function hasStrictTime(value: string): boolean {
  const text = normalizeText(value);
  return /\b(?:sharp|on the dot|cannot wait|can'?t wait|no later than|at the latest|hard deadline|must leave|must depart)\b|\b(?:only|exactly|strictly)\b.{0,20}\d{1,2}(?::\d{2}|\s*[ap]m)|\d{1,2}(?::\d{2}|\s*[ap]m)\s*(?:only|sharp|exactly)|只能|必须.{0,10}(?:出[发發]|[离離][开開])|最[迟遲晚]|准[时時]|準時|不等|不能等|唔等|[点點].{0,8}不行/.test(
    text,
  );
}
