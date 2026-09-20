import type { MatchIntent, MatchPost } from './types.ts';
import { residenceDateRange, residenceMonthRange } from './residence-text.ts';
import { loanPeriod } from './loan.ts';
import { parseResidenceLabel } from './constraints.ts';
import { extractSchedule, isCancelled, normalizeText } from './text.ts';

type HallMention = { hall: string; start: number; end: number; raw: string };
type Mention = { entity: string; start: number; end: number; raw: string };
const roman = [
  '',
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
  'xiii',
];
const chinese = [
  '',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
  '十三',
];
const numberPattern =
  '(?:xiii|xii|viii|vii|iii|xi|ix|vi|iv|ii|x|v|i|十三|十二|十一|十|九|八|七|六|五|四|三|二|一|[0-9]{1,2})';
const namespacePattern =
  '(?:undergraduate|postgraduate|post[- ]?grad|undergrad|研究生|本科生?|碩士|硕士|博士|pgh?|ug)';
const placeholder =
  /^(?:[-?？.\s]+|n\/?a|none|null|idk|unknown|tbd|x|不知道|未知|待定|未定)$/i;
const inactive = (post: MatchPost) =>
  Boolean(post.status && post.status !== 'active');
const literal = (text: string) => text.trim().slice(0, 420);
const evidenceFor = (
  post: MatchPost,
  extras: (string | null | undefined)[] = [],
) =>
  [
    ...new Set(
      [...extras, post.title, post.body]
        .filter((value): value is string => Boolean(value?.trim()))
        .map(literal),
    ),
  ].slice(0, 5);
const noAction = (text: string) =>
  /^(?:nvm|never ?mind|just (?:looking|browsing|testing)|test(?: post)?|anyone (?:here|around)\??|hi+|hey|随便看看|隨便看看|随便问问|隨便問問|测试|測試|有冇人呀|有人吗|有人嗎|1)[.!。！?？\s]*$/i.test(
    text.trim(),
  );
function canonicalHall(raw: string, namespace?: string): string | undefined {
  const value = normalizeText(raw).replace(/[\s\u2000-\u200f]/g, '');
  const number = /^\d+$/.test(value)
    ? Number(value)
    : Math.max(roman.indexOf(value), chinese.indexOf(value));
  if (number < 1 || number > 13) return;
  return `${namespace && /pg|post|研究|碩士|硕士|博士/i.test(namespace) ? 'pg' : 'ug'}-hall-${number}`;
}
function hallMentions(text: string): HallMention[] {
  const found: HallMention[] = [];
  const patterns = [
    new RegExp(
      `(${namespacePattern})?\\s*(?:halls?|dorm(?:itory)?|residence(?: hall)?|宿舍|宿|舍)\\s*[-#]?\\s*(${numberPattern})(?![a-z0-9])(?:\\s*\\(\\s*(ug|pg)\\s*\\))?`,
      'gi',
    ),
    new RegExp(
      `(${namespacePattern})\\s*[-#]?\\s*(${numberPattern})(?![a-z0-9])`,
      'gi',
    ),
    new RegExp(
      `(${namespacePattern})?\\s*(${numberPattern})\\s*(?:号宿舍|號宿舍|舍|宿(?:舍)?)(?![a-z0-9])`,
      'gi',
    ),
  ];
  for (const pattern of patterns)
    for (const match of text.matchAll(pattern)) {
      const hall = canonicalHall(match[2], match[1] || match[3]);
      if (hall)
        found.push({
          hall,
          start: match.index!,
          end: match.index! + match[0].length,
          raw: match[0].trim(),
        });
    }
  for (const match of text.matchAll(
    /\b(?:ua|university apartments?)\s+towers?\s+(c\s*(?:[–—-]|and|&)\s*d|[a-d])\b/gi,
  )) {
    found.push({
      hall: `ua-tower-${match[1].toLowerCase().replace(/\s*(?:[–—-]|and|&)\s*/g, '-')}`,
      start: match.index!,
      end: match.index! + match[0].length,
      raw: match[0],
    });
  }
  // A bare route end, e.g. “UG Hall XI -> XIII”, inherits only the explicit
  // namespace of the preceding hall; an explicitly named Hall I remains UG.
  const explicit = [...found].sort((a, b) => a.start - b.start);
  for (const mention of explicit) {
    const after = text.slice(mention.end);
    const short = after.match(
      new RegExp(
        `^\\s*(?:[-=]?>|→|↔|⇄|to|換到?|换到?|去)\\s*(${numberPattern})(?![a-z0-9])`,
        'i',
      ),
    );
    if (short) {
      const hall = canonicalHall(
        short[1],
        mention.hall.startsWith('pg-') ? 'pg' : 'ug',
      );
      if (hall)
        found.push({
          hall,
          start: mention.end + short[0].lastIndexOf(short[1]),
          end: mention.end + short[0].length,
          raw: short[1],
        });
    }
  }
  return found
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter(
      (mention, index, all) =>
        !all
          .slice(0, index)
          .some(
            (previous) =>
              mention.start >= previous.start && mention.end <= previous.end,
          ),
    );
}
function hallField(value: string | null | undefined): string | undefined {
  if (!value || placeholder.test(value)) return;
  const mentions = hallMentions(normalizeText(value));
  return mentions.length === 1 ? mentions[0].hall : undefined;
}
const roomPattern =
  /\b(?:single(?:[- ](?:person|occupancy))?|double|twin|triple|quadruple|[1234][- ](?:person|bed))\b|单人(?:间|房)?|單人(?:間|房)?|双人(?:间|房)?|雙人(?:間|房)?|三人(?:间|間|房)?|四人(?:间|間|房)?|单间|單間/gi;
function roomName(text: string): string {
  return /single|1[- ]|单|單/i.test(text)
    ? 'single'
    : /double|twin|2[- ]|双|雙/i.test(text)
      ? 'double'
      : /triple|3[- ]|三/i.test(text)
        ? 'triple'
        : 'quadruple';
}
function roomConstraints(
  text: string,
  post: MatchPost,
  mentions: HallMention[],
  from?: string,
  to?: string,
) {
  const rooms = [...text.matchAll(roomPattern)].filter(
    (match) =>
      !/^\s*(?:semester|term|学期|學期)/i.test(
        text.slice(match.index! + match[0].length),
      ),
  );
  let room =
    post.roomType && !placeholder.test(post.roomType)
      ? [...normalizeText(post.roomType).matchAll(roomPattern)].map((match) =>
          roomName(match[0]),
        )[0]
      : undefined;
  let wantedRoom: string | undefined;
  let ambiguousPreference = false;
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i],
      b = rooms[i + 1];
    const between = text.slice(a.index! + a[0].length, b.index!);
    if (
      /^(?:\s|房|间|間|room|现在|現在|只考虑|只考慮)*(?:to|for|[-=]?>|→|↔|⇄|换|換|只考虑|只考慮|only)(?:\s|a|an|房|room)*$/i.test(
        between,
      )
    ) {
      room = roomName(a[0]);
      wantedRoom = roomName(b[0]);
    }
  }
  for (const match of rooms) {
    const start = match.index!;
    const before = text.slice(Math.max(0, start - 45), start);
    const nearestHall = mentions.filter((hall) => hall.end <= start).at(-1);
    if (/(?:not|no|neither|不要|不接受|唔要)\s*(?:a\s*)?$/.test(before)) {
      ambiguousPreference = true;
      continue;
    }
    if (
      /(?:want(?:ed)?|need|hoping to get|would take|would accept|exchange for|swap for|looking for|lookin for|seek(?:ing)?|prefer|only consider|只考虑|只考慮|必须|必須|想要|目标(?:也是)?|目標(?:也是)?|希望|求)\s*(?:a|an)?\s*$/i.test(
        before,
      )
    )
      wantedRoom = roomName(match[0]);
    else if (
      /(?:currently|current|my|have|现在|現在|目前|而家)\s*(?:a|in a|住)?\s*$/i.test(
        before,
      )
    )
      room = roomName(match[0]);
    else if (nearestHall && start - nearestHall.end < 30) {
      if (nearestHall.hall === to && to !== from)
        wantedRoom ??= roomName(match[0]);
      else if (nearestHall.hall === from) room ??= roomName(match[0]);
    }
  }
  const firstHall = mentions.find((hall) => hall.hall === from);
  if (!room && firstHall) {
    const beforeCurrent = rooms
      .filter(
        (match) =>
          match.index! < firstHall.start &&
          !/(?:want|seek|looking for|只要|必须|必須|目标|目標)/.test(
            text.slice(Math.max(0, match.index! - 30), match.index!),
          ),
      )
      .at(-1);
    if (beforeCurrent) room = roomName(beforeCurrent[0]);
  }
  let wantedRooms: string[] | undefined;
  for (let i = 0; i < rooms.length - 1; i++) {
    const first = rooms[i], second = rooms[i+1];
    const between = text.slice(first.index!+first[0].length,second.index!);
    const after = text.slice(second.index!+second[0].length,second.index!+second[0].length+35);
    const before = text.slice(Math.max(0,first.index!-35),first.index!);
    if (/^\s*(?:or|或|或者)\s*$/.test(between) &&
        /^(?:\s|房|间|間)*(?:both (?:okay|ok|fine)|都(?:可以|可|得)|均可)/.test(after) &&
        !/(?:not|不要|不接受)\s*$/.test(before)) {
      wantedRooms = [...new Set([roomName(first[0]),roomName(second[0])])];
    }
  }
  return { room, wantedRoom, wantedRooms, ambiguousPreference };
}
function termConstraint(text: string): string | undefined {
  const dates = residenceDateRange(text);
  if (dates.found) return dates.term;
  const months = residenceMonthRange(text);
  if (months.found) return months.term;
  // An explicit academic-year label is not a season or an inferred date range.
  // Keep ambiguous/multiple periods unknown rather than selecting the first year.
  const academicYears = [...text.matchAll(/\b(20\d{2})\s*[/–—-]\s*(20\d{2}|\d{2})(?![\d/-])/g)];
  if (academicYears.length && /academic|full[ -]?year|(?:entire|complete|whole).{0,18}year|all of (?:20\d{2}[/–—-])|全年|全学年|全學年|学年|學年/.test(text)) {
    if (/\b(?:not|except|excluding)\s+(?:for\s+)?(?:the\s+)?(?:full|entire|complete|whole|academic)\b|不是全年|非全年|不含全年/.test(text)) return;
    const labels = academicYears.map(match => {
      const start = Number(match[1]);
      const end = match[2].length === 2 ? Math.floor(start / 100) * 100 + Number(match[2]) : Number(match[2]);
      return `academic:${start}-${end}`;
    });
    if (new Set(labels).size !== 1 || !parseResidenceLabel(labels[0])) return;
    // A semester restriction cannot be upgraded to full-year occupancy.
    if (/\b(?:fall|autumn|spring|summer|winter)\b|秋季?|春季?|夏季?|暑期|冬季?/.test(text)) return;
    if (academicYears.some(match => /(?:not|except|excluding|不是|非|不含)\s*$/.test(text.slice(Math.max(0, match.index - 20), match.index)))) return;
    return labels[0];
  }
  const match =
    /\b(fall|autumn|spring|summer|winter)(?:\s+(?:semester|term))?\b|秋季?|春季?|夏季?|暑期|冬季?/i.exec(
      text,
    );
  if (!match) return;
  const term = /fall|autumn|秋/i.test(match[0])
    ? 'fall'
    : /spring|春/i.test(match[0])
      ? 'spring'
      : /summer|夏|暑/i.test(match[0])
        ? 'summer'
        : 'winter';
  const around = text.slice(
    Math.max(0, match.index - 14),
    match.index + match[0].length + 14,
  );
  const year = /\b(20\d{2})\b/.exec(around)?.[1];
  return year ? `${term}:${year}` : term;
}
function eligibilityConstraint(text: string): string | undefined {
  if (
    /any gender|all genders|gender (?:doesn.t matter|neutral)|男女不限|性别不限|性別不限|不限性别|不限性別/.test(
      text,
    )
  )
    return 'any';
  const positive = (pattern: RegExp) =>
    [...text.matchAll(pattern)].some(
      (match) =>
        !/(?:not|no|except|excluding|不是|非|不要|不接受)\s*$/.test(
          text.slice(Math.max(0, match.index! - 20), match.index),
        ),
    );
  const female = positive(
    /\b(?:female|women|woman|girls?)\b|女生|女性|女仔|女宿|女(?=ug|pg|本科|研究生|[、，,.；;\s])/g,
  );
  const male = positive(
    /\b(?:male|men|man|boys?)\b|男生|男性|男仔|男宿|男(?=ug|pg|本科|研究生|[、，,.；;\s])/g,
  );
  return female && !male ? 'female' : male && !female ? 'male' : undefined;
}

/** Extract room swaps from the public description, regardless of the menu category. */
export function parseHousing(post: MatchPost): MatchIntent[] {
  if (inactive(post) || noAction(post.body)) return [];
  if (
    /已取消(?:换|換)宿|(?:不|唔)(?:换|換)了|(?:hall|room|swap).{0,12}(?:cancelled|withdrawn)|(?:cancelled|withdrawn).{0,12}(?:hall|room|swap)/i.test(
      `${post.title} ${post.body}`,
    )
  )
    return [];
  const routeSource = hallMentions(normalizeText(post.body)).length
    ? post.body
    : `${post.title}\n${post.body}`;
  const text = normalizeText(
    routeSource
      .split(/(?<=[.!。;；])\s*|\n|\bbut\b/iu)
      .filter((clause) => !isCancelled(clause))
      .join(' '),
  );
  if (
    /\b(?:not|no longer|don.t|do not)\s+(?:want(?:ing)? to )?(?:swap|switch|exchange|move)|(?:不想|不用|不再|唔想|唔再)\s*(?:换|換|转|轉)宿?/.test(
      text,
    )
  )
    return [];
  const mentions = hallMentions(text);
  const structuredFrom = hallField(post.currentHall),
    structuredTo = hallField(post.targetHall);
  const housingCue =
    /\bswap\b|\b(?:room|hall|dorm)\s+(?:exchange|change|switch)\b|\b(?:change|switch|exchange)\s+(?:my\s+)?(?:room|hall|dorm)\b|换宿|換宿|转宿|轉宿|換\s*hall|换\s*hall|(?:想|求|想要|希望).{0,10}(?:换|換)/.test(
      text,
    );
  const routeCue =
    mentions.length >= 2 &&
    /->|→|↔|⇄|\b(?:to|want|need|seek(?:ing)?|looking for|would take|would accept)\b|换|換|去/.test(text);
  const otherCue =
    /\bsell(?:ing)?\b|\bbuy(?:ing)?\b|\btextbook\b|\brevision buddy\b|\btaxi\b|拼车|拼車|出售|求购|求購|温书|溫書/.test(
      text,
    );
  if (
    !housingCue &&
    !routeCue &&
    !(post.category === 'hall' && structuredFrom && structuredTo && !otherCue)
  )
    return [];
  let from: string | undefined = structuredFrom;
  const targets: string[] = [];
  const excludedTargets = new Set<string>();
  let lastTarget: HallMention | undefined;
  const missing: string[] = [];
  for (const mention of mentions) {
    const before = text.slice(Math.max(0, mention.start - 60), mention.start);
    // A sentence-led allocation label may separate the room and hall with a comma.
    if (/(?:^|[.!。\n])\s*confirmed (?:male |female )?(?:single|double|twin|triple)(?: room)?\s*[,，]\s*$/.test(before))
      from ??= mention.hall;
    const negative =
      /(?:not|except|avoid|excluding|不是|不想去|不要|不想要|不考虑|不考慮|唔要|除咗|除了)\s*(?:the\s+)?$/.test(
        before,
      );
    if (negative) {
      excludedTargets.add(mention.hall);
      continue;
    }
    if (
      /(?:currently(?:\s+(?:in|at))?|from|i(?:'m| am| live| stay| am living)\s+(?:in|at)|my(?: current)?(?: hall| room)?(?: is)?|have(?: an?)?|i hold(?: an?)?|allocated(?: (?:single|double|twin|triple)(?: room)?)?(?: in)?|confirmed(?: (?:male|female))?(?: (?:single|double|twin|triple)(?: room)?)?(?: in)?|已分配|目前|当前|當前|现在|現在|而家|现住|現住|我住(?:在)?|我在|由|从|從)\s*[:：]?\s*$/.test(
        before,
      )
    )
      from ??= mention.hall;
    if (
      /(?:looking|lookin|searching)\s+(?:for|to move to)\s*(?:a room in\s*)?$|(?:want(?:ed|ing)?|would take|would accept|need|seek(?:ing)?|prefer|move|switch)\s*(?:to|a room in|a (?:single|double|twin|triple)(?: room)? in|in|a|an)?\s*$|(?:\bto|into|for|想换去?|想換去?|想去|换到|換到|目标(?:是|係)?|目標(?:是|係)?|希望去|求换|求換|去)\s*$/.test(
        before,
      )
    ) {
      targets.push(mention.hall);
      lastTarget = mention;
    } else if (
      lastTarget &&
      /^(?:\s|[,/、]|or|或者?|又或者|以及|and)+$/.test(
        text.slice(lastTarget.end, mention.start),
      )
    ) {
      targets.push(mention.hall);
      lastTarget = mention;
    }
  }
  for (let i = 0; i < mentions.length - 1; i++) {
    const a = mentions[i],
      b = mentions[i + 1];
    const between = text.slice(a.end, b.start);
    if (excludedTargets.has(b.hall)) continue;
    if (
      (/[-=]?>|→|↔|⇄|\bto\b|换|換|去/.test(between) ||
        (housingCue && /\bfor\b/.test(between))) &&
      !/(?:not|don't|不要|不想|唔要)/.test(between)
    ) {
      from ??= a.hall;
      if (!targets.includes(b.hall)) targets.push(b.hall);
    }
  }
  if (from && structuredFrom && from !== structuredFrom)
    missing.push('from_conflict');
  from ??= structuredFrom;
  if (
    structuredTo &&
    !excludedTargets.has(structuredTo) &&
    targets.length &&
    !targets.includes(structuredTo)
  ) {
    missing.push('to_conflict');
    targets.push(structuredTo);
  }
  if (
    !structuredTo &&
    post.targetHall &&
    /\bor\b|或|[、/]/.test(post.targetHall)
  ) {
    for (const target of hallMentions(normalizeText(post.targetHall)))
      if (!excludedTargets.has(target.hall) && !targets.includes(target.hall))
        targets.push(target.hall);
  }
  if (!targets.length && structuredTo && !excludedTargets.has(structuredTo))
    targets.push(structuredTo);
  if (!from) missing.push('from');
  if (!targets.length) missing.push('to');
  if (!from && !targets.length) return [];
  // These are author statements, not independent verification of university records.
  const allocation: MatchIntent['allocation'] = /\b(?:not allocated|no allocation|allocation denied|application rejected)\b|未获批|未獲批|分配被拒/.test(text) ? 'denied'
    : /\b(?:not yet allocated|allocation pending|awaiting allocation)\b|\b(?:pending|waiting for|awaiting)\b.{0,30}\b(?:allocation|room|offer)\b|尚未获批|尚未獲批|等候分配|等待分配/.test(text) ? 'pending'
    : /\b(?:allocated|confirmed (?:single|double|room)|have an allocation)\b|已获批|已獲批|已批|已有分配/.test(text) ? 'confirmed' : undefined;
  const exchangeEligibility: MatchIntent['exchangeEligibility'] = /\b(?:ineligible|not eligible)\b|没有换宿资格|沒有換宿資格|不符合換宿資格|不符合换宿资格/.test(text) ? 'ineligible'
    : /\b(?:eligibility pending|(?:unsure|not sure).{0,15}eligible)\b|资格待确认|資格待確認/.test(text) ? 'pending'
    : /\beligible\b|已符合換宿資格|已符合换宿资格|換宿資格已確認|换宿资格已确认|有換房資格|有换房资格/.test(text) ? 'eligible' : undefined;
  const term = termConstraint(text);
  const eligibility = eligibilityConstraint(
    normalizeText(post.genderEligibility ?? '') + ' ' + text,
  );
  return [...new Set(targets.length ? targets : [undefined])]
    .slice(0, 6)
    .flatMap((to) => {
      if (from && to && from === to) return [];
      const { ambiguousPreference, ...rooms } = roomConstraints(text, post, mentions, from, to);
      return [
        {
          kind: 'hall',
          entity: `${from ?? '?'}->${to ?? '?'}`,
          side: 'swap',
          from,
          to,
          ...rooms,
          term,
          eligibility,
          allocation,
          exchangeEligibility,
          evidence: evidenceFor(post, [
            post.currentHall,
            post.targetHall,
            post.roomType,
            post.genderEligibility,
          ]),
          missing: [...missing, ...(ambiguousPreference ? ['room-preference'] : [])],
        } satisfies MatchIntent,
      ];
    });
}

// Vocabulary names common objects, rather than memorising sentences or labels.
const goodsVocabulary: [string, string][] = [
  ['drill', '\\b(?:(?:cordless|electric|power) )?drills?\\b|電鑽|电钻'],
  ['display-adapter', '\\busb[ -]?c (?:to )?hdmi adapter\\b|usb[ -]?c(?:轉|转|接)hdmi(?:轉接器|转接器|轉插|转插)?'],
  [
    'desk-lamp',
    '\\b(?:desk|table|study|reading|bedside) lamp\\b|\\blamp\\b|台灯|臺燈|枱燈|檯燈|书桌灯|書桌燈',
  ],
  [
    'calculator',
    '\\bcalculators?\\b|\\b(?:casio\\s*)?fx[ -]?\\d+[a-z\\d-]*\\b|\\bti[ -]?(?:30|36|84|89|nspire)\\b|计算器|計算器|計算機',
  ],
  [
    'bike',
    '\\b(?:bicycles?|bikes?|road bike|mountain bike)\\b|自行车|自行車|单车|單車|腳踏車',
  ],
  [
    'kettle',
    '\\b(?:electric )?kettles?\\b|电热水壶|電熱水壺|热水壶|熱水壺|水壶|水壺|水煲',
  ],
  [
    'monitor',
    '\\b(?:monitors?|external displays?|computer screens?)\\b|显示器|顯示器|显示屏|顯示屏|螢幕|屏幕|電腦屏',
  ],
  ['guitar', '\\b(?:acoustic |electric )?guitars?\\b|吉他|結他'],
  [
    'textbook',
    '\\b(?:text[ -]?books?|course books?)\\b|教科书|教科書|教材|课本|課本',
  ],
  [
    'chair',
    '\\b(?:(?:office|desk|gaming|ergonomic) )?chairs?\\b|座椅|椅子|椅|凳',
  ],
  ['desk', '\\b(?:desks?|tables?)\\b|书桌|書桌|書枱|桌子'],
  [
    'fan',
    '\\b(?:(?:electric|desk|standing) )?fans?\\b|电风扇|電風扇|风扇|風扇',
  ],
  ['fridge', '\\b(?:mini[ -]?)?(?:fridges?|refrigerators?)\\b|冰箱|雪櫃'],
  ['microwave', '\\bmicrowave(?: ovens?)?\\b|微波炉|微波爐'],
  ['rice-cooker', '\\brice cookers?\\b|电饭煲|電飯煲|電飯鍋'],
  ['air-fryer', '\\bair[ -]?fryers?\\b|空气炸锅|空氣炸鍋|氣炸鍋'],
  ['hair-dryer', '\\bhair[ -]?dryers?\\b|吹风机|吹風機|風筒'],
  ['printer', '\\bprinters?\\b|打印机|打印機|印表機'],
  [
    'laptop',
    '\\b(?:laptops?|notebook computers?|macbooks?|thinkpads?)\\b|笔记本电脑|筆記本電腦|笔电|筆電|手提电脑|手提電腦',
  ],
  ['tablet', '\\b(?:tablets?|ipads?)\\b|平板(?:电脑|電腦)?'],
  [
    'phone',
    '\\b(?:smartphones?|mobile phones?|cellphones?|iphones?)\\b|手机|手機',
  ],
  ['keyboard', '\\bkeyboards?\\b|键盘|鍵盤'],
  [
    'mouse',
    '\\b(?:computer |wireless |gaming )?mou(?:se|ses)\\b|鼠标|鼠標|滑鼠',
  ],
  [
    'headphones',
    '\\b(?:headphones?|earphones?|earbuds?|airpods?)\\b|耳机|耳機|耳塞',
  ],
  ['router', '\\b(?:wi[ -]?fi )?routers?\\b|路由器'],
  ['camera', '\\b(?:digital )?cameras?\\b|相机|相機'],
  ['power-bank', '\\bpower[ -]?banks?\\b|充电宝|充電寶|尿袋'],
  ['charger', '\\b(?:chargers?|power adapters?)\\b|充电器|充電器'],
  [
    'cable',
    '\\b(?:usb[ -]?c |charging |hdmi )?cables?\\b|数据线|數據線|充电线|充電線',
  ],
  ['suitcase', '\\b(?:suitcases?|luggage)\\b|行李箱|旅行箱|行李喼|喼'],
  ['backpack', '\\b(?:backpacks?|rucksacks?)\\b|背包|书包|書包'],
  ['yoga-mat', '\\byoga mats?\\b|瑜伽[垫墊]'],
  ['umbrella', '\\bumbrellas?\\b|雨伞|雨傘'],
  ['mattress', '\\bmattress(?:es)?\\b|床垫|床墊'],
  ['bookshelf', '\\b(?:bookshel(?:f|ves)|bookcases?)\\b|书架|書架'],
  [
    'storage-box',
    '\\b(?:storage boxes?|storage bins?)\\b|收纳箱|收納箱|收纳盒|收納盒',
  ],
  ['hoodie', '\\bhoodies?\\b|卫衣|衛衣'],
  ['jacket', '\\bjackets?\\b|外套'],
  ['shoes', '\\b(?:shoes|sneakers|trainers)\\b|运动鞋|運動鞋|波鞋'],
  [
    'ticket',
    '\\b(?:concert |cinema |movie )?tickets?\\b|门票|門票|电影票|電影票',
  ],
  [
    'game-console',
    '\\b(?:gaming consoles?|game consoles?|nintendo switch|playstation ?[345]|ps[345]|xbox(?: series [sx])?)\\b|游戏机|遊戲機',
  ],
  ['controller', '\\b(?:game |gaming )?controllers?\\b|游戏手柄|遊戲手掣|手柄'],
  ['vacuum', '\\bvacuum(?: cleaners?)?\\b|吸尘器|吸塵器|吸塵機'],
  ['heater', '\\bheaters?\\b|暖炉|暖爐|暖风机|暖風機'],
  ['dehumidifier', '\\bdehumidifiers?\\b|抽湿机|抽濕機|除湿机|除濕機'],
  ['humidifier', '\\bhumidifiers?\\b|加湿器|加濕器'],
  ['skateboard', '\\bskateboards?\\b|滑板(?!车|車)'],
  ['scooter', '\\b(?:electric )?scooters?\\b|滑板车|滑板車'],
  [
    'water-bottle',
    '\\b(?:water bottles?|thermos(?:es)?)\\b|保温杯|保溫杯|水樽|运动水壶|運動水壺',
  ],
];
const productFamilies: [string, RegExp][] = [
  ['monitor', /\b(?:dell|benq|aoc)\s*[a-z]{1,4}\d{3,4}[a-z0-9]*\b/gi],
  [
    'keyboard',
    /(?:\b(?:logitech|罗技|羅技)\s*)?\b(?:k\d{2,4}|mx\s*keys(?:\s*mini)?)\b/gi,
  ],
  [
    'headphones',
    /(?:\bsony\s*)?\bwh[- ]?\d{3,4}[a-z0-9]*\b|\bairpods(?:\s*pro)?(?:\s*[1-9])?\b/gi,
  ],
  ['camera', /\b(?:sony\s*)a\d{3,4}\b/gi],
  ['stylus', /\bapple\s*pencil(?:\s*[1-3])?\b/gi],
  [
    'textbook',
    /\bisbn(?:-1[03])?\s*[:：]?\s*[\d-]{10,17}\b|第[一二三四五六七八九十\d]+版|\b(?:first|second|third|fourth|fifth|sixth|\d+(?:st|nd|rd|th)) edition\b/gi,
  ],
  [
    'phone',
    /\biphone\s*(?:\d{1,2}|se)(?:\s*(?:pro\s*max|pro|max|mini|plus))?\b/gi,
  ],
];
function goodsMentions(text: string): Mention[] {
  const mentions = goodsVocabulary.flatMap(([entity, pattern]) =>
    [...text.matchAll(new RegExp(pattern, 'gi'))].map((match) => ({
      entity,
      start: match.index!,
      end: match.index! + match[0].length,
      raw: match[0],
    })),
  );
  for (const [entity, pattern] of productFamilies)
    for (const match of text.matchAll(pattern))
      mentions.push({
        entity,
        start: match.index!,
        end: match.index! + match[0].length,
        raw: match[0],
      });
  const distinct = mentions
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .filter(
      (mention, index, all) =>
        !all
          .slice(0, index)
          .some(
            (previous) =>
              mention.start < previous.end && mention.end > previous.start,
          ),
    )
    .sort((a, b) => a.start - b.start);
  const merged: Mention[] = [];
  for (const mention of distinct) {
    const previous = merged.at(-1);
    const gap = previous ? text.slice(previous.end, mention.start) : '';
    const sameBookEdition =
      previous?.entity === 'textbook' &&
      mention.entity === 'textbook' &&
      /edition|版|isbn/.test(previous.raw + ' ' + mention.raw) &&
      /^[\s,，]*$/.test(gap);
    if (
      previous &&
      previous.entity === mention.entity &&
      gap.length < 45 &&
      (sameBookEdition ||
        !/[.;；。,$\d]|\b(?:and|or|sell|buy|need|want|looking|not|except)\b|不|出|收|求|买|買|卖|賣/.test(
          gap,
        ))
    ) {
      previous.end = mention.end;
      previous.raw = text.slice(previous.start, previous.end);
    } else merged.push({ ...mention });
  }
  return merged;
}
const offerPattern =
  /\b(?:sell(?:ing)?|for sale|wts|give(?:n|ing)? away|giveaway|giving away|free to (?:take|collect)|let(?:ting)? go|offer(?:ing)?|lend(?:ing)?|spare)\b|出售|转让|轉讓|放售|卖|賣|闲置|閒置|免费送|免費送|送出|出借|(?:^|[\s，,。:：])(?:出|放|送)(?!发|發|学|學|现|現|弃|棄)/gi;
const seekPattern =
  /\b(?:lookin(?:g)?(?: to buy| for)?|seek(?:ing)?|want(?:ed|ing)?(?: to buy)?|need(?:ed|ing)?|buy(?:ing)?|wtb|iso|borrow(?:ing)?|in search of|would like to take)\b|求购|求購|求收|想买|想買|要买|要買|买|買|需要|想借|求借|征求|徵求|征|徵|求一|想收|(?:^|[\s，,。:：])收|同求|有(?:没有|冇|無)人(?:出|放|卖|賣)|搵/gi;
function sideFor(
  text: string,
  mention: Mention,
): { side?: 'offer' | 'seek'; negated: boolean } {
  const before = text.slice(0, mention.start);
  const candidates = (
    [
      ['offer', offerPattern],
      ['seek', seekPattern],
    ] as const
  ).flatMap(([side, pattern]) =>
    [...before.matchAll(pattern)].map((match) => ({
      side,
      start: match.index!,
      end: match.index! + match[0].length,
    })),
  );
  const nearest = candidates.sort((a, b) => b.end - a.end)[0];
  const explicitAfter = text.slice(mention.end, mention.end + 80);
  if (/(?:沒有|没有|冇|\bno|\bdo not have|\bdon't have)\s*(?:an?\s+)?$/.test(before)) return {negated:true};
  const postfix =
    /\b(?:asking|for sale|(?:still )?available)\b|免費送|免费送|仍出|放售|出售|售\s*\d/.exec(
      explicitAfter,
    );
  if (
    postfix &&
    !/(?:not|un|不|唔)\s*$/.test(explicitAfter.slice(0, postfix.index)) &&
    !/\b(?:not|never|don.t|do not)\s+sell|不再卖|不再賣/.test(before)
  )
    return { side: 'offer', negated: false };
  if (/^(?:\s|[，,])*仍出/.test(explicitAfter))
    return { side: 'offer', negated: false };
  if (nearest && mention.start - nearest.end <= 160) {
    const prefix = text.slice(Math.max(0, nearest.start - 35), nearest.start);
    const suffix = text.slice(mention.end, mention.end + 40);
    const negated =
      /(?:not|never|don.t|do not|no longer|stop(?:ped)?|isn.t|aren.t|不|不再|不是|唔|唔再|无需|無需|不用)\s*$/.test(
        prefix,
      ) ||
      /^\s*(?:is |has been |已|已经|已經)?(?:sold|gone|reserved|售出|卖出|賣出|出咗|已收|买到|買到)/.test(
        suffix,
      );
    return { side: nearest.side, negated };
  }
  const after = text.slice(mention.end, mention.end + 90);
  if (
    /^(?:\s|[，,:：]|is |are |still |仍|尚|正常)*?(?:for sale|available|to give away|asking|放售|出售|出让|出讓|仍出|售)/.test(
      after,
    )
  )
    return { side: 'offer', negated: false };
  if (
    /^\s*(?:is |are )?(?:for sale|available|to give away|出售|出让|出讓)/.test(
      after,
    )
  )
    return { side: 'offer', negated: false };
  if (/^\s*(?:wanted|needed|求购|求購|征求|徵求)/.test(after))
    return { side: 'seek', negated: false };
  return { negated: false };
}
function priceConstraint(
  text: string,
  side: 'offer' | 'seek',
): { price?: number; missing: string[] } {
  const pricedFree = /\b(?:giveaway|giving away|give away|no charge|for free)\b|免费赠送|免費贈送|不收钱|不收錢/.test(text)
    || (/\bfree\b|免费|免費/.test(text)
      && !/\bfree\s+(?:delivery|shipping|pickup|collection|after|before|on|from|today|tomorrow|time)|免费(?:配送|送货|送貨|运输|運輸)|免費(?:配送|送货|送貨|运输|運輸)/.test(text));
  const freePrice = pricedFree && !/not free|不是免费|不是免費/.test(text);
  const prices = [
    ...text.matchAll(
      /(?:hk\s*\$|hkd\s*\$?|hk\$|港币|港幣|\$)\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.\d{1,2})?)|((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.\d{1,2})?)\s*(?:hkd|hk\$|港币|港幣|蚊|元|块|塊|dollars?)|(?:asking|ask|budget(?:\s+(?:up to|of|is))?|up to|at most|max(?:imum)?|limit|under|<=|≤|要价|要價|预算(?:上限)?|預算(?:上限)?|最多出|最高|最多|卖|賣|售)\s*[:：]?\s*(?:hkd|hk\$|\$)?\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.\d{1,2})?)/gi,
    ),
  ];
  const values = [
    ...new Set(
      prices.map((match) =>
        Number((match[1] || match[2] || match[3]).replaceAll(',', '')),
      ),
    ),
  ];
  if (!values.length) return freePrice ? { price: 0, missing: [] } : { missing: [] };
  if (freePrice && values.some(value => value !== 0)) return { missing: ['price_ambiguous'] };
  if (
    values.length > 1 ||
    prices.some((match) =>
      /^\s*(?:-|–|~|至|到)\s*(?:hk\$|hkd|\$)?\s*\d/.test(
        text.slice(match.index! + match[0].length),
      ),
    ) ||
    (side === 'offer' &&
      /(?:at least|no less than|not below|minimum|底价|底價|至少)/.test(text))
  )
    return { missing: ['price_ambiguous'] };
  if (
    /(?:both|bundle|together)\s*(?:for|at|hk|\$|\d)|合共|合计|合計|打包|一共/.test(
      text,
    ) &&
    !/each|per item|每件|各/.test(text)
  )
    return { missing: ['bundle_price'] };
  return { price: values[0], missing: [] };
}
function bookTitle(text: string): string | undefined {
  const quoted = /(?:title|book|textbook)\s*(?::|is)?\s*[“"]([^”"]{4,160})[”"]|《([^》]{2,100})》/.exec(text);
  if (quoted) return normalizeText(quoted[1] || quoted[2]);
  // A literal title/subtitle ending immediately before an explicit edition.
  const titled = /([a-z][a-z .'-]{2,80}:\s*[a-z][a-z .'-]{2,100}),?\s*(?=\d{1,2}(?:st|nd|rd|th) edition|第[一二三四五六七八九十\d]+版)/i.exec(text);
  if (!titled) return undefined;
  return normalizeText(titled[1]).replace(/^(?:looking to buy|looking for|want to buy|buying|selling|buy|sell)\s+/, '').replace(/[, ]+$/, '');
}
function modelConstraint(text: string, entity: string): string | undefined {
  text = normalizeText(text)
    .replace(/罗技|羅技/g, 'logitech')
    .replace(/小米/g, 'xiaomi')
    .replace(/索尼/g, 'sony')
    .replace(/宜家/g, 'ikea');
  if (entity === 'drill') {
    const voltage = /\b(\d{1,3})\s*v\b/.exec(text);
    return voltage ? `voltage:${Number(voltage[1])}v` : undefined;
  }
  const patterns = [
    /\b(?:casio\s*)?(fx[ -]?\d+[a-z\d-]*(?:\s+(?:plus|ex|es|cw|ms|classwiz))?)\b/i,
    /\b(ti[ -]?(?:30|36|84|89|nspire)[a-z\d-]*(?:\s+(?:plus|ce|cx|ii|cas))*)\b/i,
    /\b(iphone\s*(?:\d{1,2}|se)(?:\s*(?:pro\s*max|pro|max|mini|plus))?)\b/i,
    /\b(ipad\s*(?:air|pro|mini)?\s*(?:[1-9](?:th|st|nd|rd)?(?:\s*gen(?:eration)?)?)?)\b/i,
    /\b(macbook\s*(?:air|pro)(?:\s*m[1-9])?)\b/i,
    /\b((?:dell|benq|lg|asus|acer|samsung|aoc)\s+[a-z]{0,5}\d{2,}[a-z\d-]*)\b/i,
    /\b(nintendo\s*switch(?:\s*(?:oled|lite))?|playstation\s*[345]|ps[345]|xbox\s*series\s*[sx])\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match)
      return match[1]
        .toLowerCase()
        .replace(/^casio\s*/, '')
        .replace(/(\d)(?:th|st|nd|rd)(?:\s*gen(?:eration)?)?/g, '$1')
        .replace('playstation', 'ps')
        .replace(/[^a-z0-9]/g, '');
  }
  const branded =
    /\b(ikea\s+[a-z]+|(?:anker)\s+\d{2,4}|(?:logitech|罗技|羅技)\s*(?:k\d{2,4}|mx\s*keys(?:\s*mini)?)|(?:sony\s*)?wh[- ]?\d{3,4}[a-z0-9]*|(?:xiaomi|小米)?\s*mi smart led desk lamp\s*\d+s?|apple\s*pencil\s*[1-3]|airpods\s*pro\s*[1-9]|(?:sony\s*)a\d{3,4})\b/i.exec(
      text,
    );
  if (branded)
    return branded[1]
      .toLowerCase()
      .replace(/罗技|羅技/g, 'logitech')
      .replace(/小米/g, 'xiaomi')
      .replace(/^(?:sony|xiaomi)\s*/, '')
      .replace(/[^a-z0-9]/g, '');
  if (entity.startsWith('textbook')) {
    const isbn = /\bisbn(?:-1[03])?\s*[:：]?\s*([\d-]{10,17})/i.exec(text);
    if (isbn) return `isbn:${isbn[1].replaceAll('-', '')}`;
    const title = bookTitle(text);
    if (title) return `title:${title}`;
    const edition =
      /\b(\d{1,2})(?:st|nd|rd|th)?[ -]*(?:ed(?:ition)?)\b|第([一二三四五六七八九十\d]+)版/i.exec(
        text,
      );
    if (edition)
      return `edition:${edition[1] || chinese.indexOf(edition[2]) || edition[2]}`;
  }
  return undefined;
}
function conditionConstraint(text: string): string | undefined {
  if (
    /\b(?:not broken|no defects|fully working|working|works? (?:fine|perfectly)|good working (?:order|condition))\b|功能正常|正常(?:使用|工作|运作|運作)?|无故障|無故障|不要坏|不要壞|唔要壞/.test(
      text,
    )
  )
    return 'working';
  if (
    /\b(?:broken|faulty|not working|for parts|dead)\b|坏了|壞咗|损坏|損壞|故障|坏的|壞的|不能用/.test(
      text,
    )
  )
    return 'broken';
  if (/\b(?:like new|as new|mint)\b|9[59]\s*新|九九新|九成新|9成新/.test(text))
    return 'like-new';
  if (
    /\b(?:brand[ -]?new|new|sealed|unused|unopened)\b|全新|未拆封|未使用/.test(
      text,
    ) &&
    !/\b(?:not|isn.t) (?:brand[ -]?)?new\b|不是全新|唔係全新/.test(text)
  )
    return 'new';
  if (/\b(?:used|second[ -]?hand|preowned|pre-owned)\b|二手/.test(text))
    return 'used';
  return undefined;
}

function editionConstraint(text: string): string | undefined {
  const words = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
  ];
  const match =
    /\b(\d{1,2})(?:st|nd|rd|th)?[ -]*(?:ed|edition)\b|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) edition\b|第([一二三四五六七八九十\d]+)版/i.exec(
      text,
    );
  if (!match) return;
  const value =
    match[1] ||
    (match[2]
      ? String(words.indexOf(match[2]) + 1)
      : /^\d+$/.test(match[3])
        ? match[3]
        : String(chinese.indexOf(match[3])));
  return Number(value) > 0 ? value : undefined;
}
function additionalGoodsConstraints(text: string, post: MatchPost) {
  const schedule = extractSchedule({ ...post, title: '', body: text });
  const places: string[] = [];
  if (/\bsports? cent(?:er|re) main entrance\b|[体體]育[馆館]正[门門]/.test(text)) places.push('sports-center-entrance');
  if (/\b(?:hkust\s*)?library\b|图书馆|圖書館/.test(text))
    places.push('hkust-library');
  if (/\b(?:hkust\s*)?north\s*gate\b|北门|北門/.test(text))
    places.push('hkust-north-gate');
  if (/\b(?:hkust\s*)?south\s*gate\b|南门|南門/.test(text))
    places.push('hkust-south-gate');
  if (/\bhang\s*hau\b|坑口/.test(text)) places.push('hang-hau');
  const colors: string[] = [];
  if (
    /any colou?r|colou?r.{0,8}(?:doesn.t matter|does not matter)|颜色不限|顏色不限|不限颜色|不限顏色/.test(
      text,
    )
  )
    colors.push('any');
  else
    for (const [color, pattern] of [
      ['black', /\bblack\b|黑色/g],
      ['white', /\bwhite\b|白色/g],
      ['silver', /\bsilver\b|银色|銀色/g],
      ['blue', /\bblue\b|蓝色|藍色/g],
      ['red', /\bred\b|红色|紅色/g],
      ['green', /\bgreen\b|绿色|綠色/g],
      ['pink', /\bpink\b|粉色|粉紅/g],
      ['grey', /\bgr[ae]y\b|灰色/g],
    ] as const) {
      for (const match of text.matchAll(pattern))
        if (
          !/(?:not|except|excluding|不要|不收|唔要)\s*$/.test(
            text.slice(Math.max(0, match.index! - 18), match.index),
          )
        )
          colors.push(color);
    }
  let quantity: number | undefined;
  const explicit =
    /\b(?:exactly|only|need|buy|selling|have)\s+(?:exactly\s+)?(one|two|three|four|five|\d+)\b|\b(one|two|three|four|five|\d+)\s+(?:units?|pieces?|monitors?|keyboards?|chairs?)\b|([一二三四五两兩\d]+)(?:台|件|把|个|個)|一对|一對|\ba pair\b/i.exec(
      text,
    );
  if (explicit) {
    const value = explicit[1] || explicit[2] || explicit[3];
    quantity = !value
      ? 2
      : /^\d+$/.test(value)
        ? Number(value)
        : (
            {
              one: 1,
              two: 2,
              three: 3,
              four: 4,
              five: 5,
              一: 1,
              二: 2,
              两: 2,
              兩: 2,
              三: 3,
              四: 4,
              五: 5,
            } as Record<string, number>
          )[value];
  }
  const priceBasis =
    /\b(?:total|bundle|for both|altogether)\b|总预算|總預算|总价|總價|一共|合共|打包/.test(
      text,
    )
      ? ('total' as const)
      : /\beach\b|per (?:item|unit)|每(?:个|個|台|件)|单价|單價/.test(text)
        ? ('unit' as const)
        : undefined;
  return {
    date: schedule.date,
    minute: schedule.minute,
    endMinute: schedule.endMinute,
    place: places.length === 1 ? places[0] : undefined,
    colors: colors.length ? [...new Set(colors)] : undefined,
    quantity,
    edition: editionConstraint(text),
    priceBasis,
    currency: /\busd(?=\b|\d)|us\s*\$|美元|美金/.test(text) ? 'USD'
      : /\b(?:cny|rmb)\b|人民币|人民幣/.test(text) ? 'CNY'
      : /\beur\b|€|欧元|歐元/.test(text) ? 'EUR'
      : /\bhkd(?=\b|\d)|hk\s*\$|港币|港幣/.test(text) ? 'HKD' : undefined,
    missing: [
      ...(schedule.ambiguous ? ['handover_time_ambiguous'] : []),
      ...(places.length > 1 ? ['handover_place_ambiguous'] : []),
    ],
  };
}
function withdrawnEntities(source: string): Set<string> {
  const result = new Set<string>();
  let previous: string[] = [];
  for (const clause of normalizeText(source).split(/[.;。；,，]|\bbut\b/)) {
    const entities = goodsMentions(clause).map((item) => item.entity);
    const withdrawn =
      isCancelled(clause) ||
      /\b(?:is sold|was sold|sold already|has been sold|not selling|not for sale)\b|不再卖|不再賣|不卖了|不賣了|唔賣|已售|已出|卖掉|賣掉/.test(
        clause,
      );
    if (withdrawn)
      for (const entity of entities.length ? entities : previous)
        result.add(entity);
    if (entities.length) previous = entities;
  }
  return result;
}

/** Separate item and direction clauses; each condition stays with its own item. */
export function parseGoods(post: MatchPost): MatchIntent[] {
  if (
    inactive(post) ||
    noAction(post.body) ||
    /^(?:\[|【)?(?:cancelled|canceled|withdrawn|sold|closed|已取消|已售出)(?:\]|】)?[.!。！ ]*$/i.test(
      post.title.trim(),
    )
  )
    return [];
  const results: MatchIntent[] = [];
  const titleText = normalizeText(post.title);
  const titleMentions = goodsMentions(titleText);
  const withdrawn = withdrawnEntities(post.body);
  const bodyEntities = new Set(
    goodsMentions(normalizeText(post.body)).map((item) => item.entity),
  );
  for (const source of [post.body, post.title]) {
    if (!source || noAction(source)) continue;
    const text = normalizeText(
      source.replace(/\n|\bbut\b|\bhowever\b|另外|另有/gi, '; '),
    );
    const mentions = goodsMentions(text);
    for (let i = 0; i < mentions.length; i++) {
      const mention = mentions[i];
      if (withdrawn.has(mention.entity)) continue;
      if (source === post.title && bodyEntities.has(mention.entity)) continue;
      const beforeMention = text.slice(
        Math.max(0, mention.start - 40),
        mention.start,
      );
      const afterMention = text.slice(mention.end, mention.end + 25);
      if (
        /(?:not|except|excluding|不考虑|不考慮|不买|不買|不收|不要|唔要)\s*$/.test(
          beforeMention,
        ) ||
        /^(?:无关|無關)|(?:无关|無關|not related)/.test(afterMention)
      )
        continue;
      const prior = mentions[i - 1],
        next = mentions[i + 1];
      const sentenceStart =
        Math.max(
          ...['\n', ';', '。', '；', '.'].map((mark) =>
            text.lastIndexOf(mark, mention.start - 1),
          ),
        ) + 1;
      const endCandidates = ['\n', ';', '。', '；', '.']
        .map((mark) => text.indexOf(mark, mention.end))
        .filter((index) => index >= 0);
      const sentenceEnd = endCandidates.length
        ? Math.min(...endCandidates)
        : text.length;
      const sentence = text.slice(sentenceStart, sentenceEnd);
      if (isCancelled(sentence)) continue;
      let direction = sideFor(sentence, {
        ...mention,
        start: mention.start - sentenceStart,
        end: mention.end - sentenceStart,
      });
      if (!direction.side && source === post.body) {
        const titleMention = titleMentions.find(
          (item) => item.entity === mention.entity,
        );
        const titleDirection = sideFor(
          titleText,
          titleMention || {
            ...mention,
            start: titleText.length,
            end: titleText.length,
          },
        );
        if (titleDirection.side) direction = titleDirection;
      }
      if (!direction.side || direction.negated) continue;
      const start = prior ? Math.max(prior.end, sentenceStart) : 0;
      const end = next ? next.start : text.length;
      const after = text
          .slice(mention.end, end)
          .split(
            /另(?:想|要|求|需|买|買)|[;；。]\s*(?:want|need|looking|buy)/i,
          )[0],
        before = text.slice(start, mention.start);
      const rawContext =
        source === post.title
          ? `${post.title} ${post.body}`
          : `${before} ${mention.raw} ${after}`;
      const context = normalizeText(rawContext);
      if (['backpack','suitcase'].includes(mention.entity) &&
          /\b(?:ride|lift|taxi|cab|passenger|carpool)\b|順風車|顺风车|的士|乘客/.test(text)) {
        const localBefore = text.slice(Math.max(text.lastIndexOf(',', mention.start - 1), text.lastIndexOf('，', mention.start - 1), sentenceStart - 1) + 1, mention.start);
        const trade = /\b(?:buy|buying|sell|selling|borrow|lend)\b|求购|求購|出售|想买|想買|出借|想借/.test(localBefore)
          || /(?:need|want|looking for|求|需要)\s*(?:(?:a|an|one|two|new|used|small|large)\s+)*$/.test(localBefore);
        const titleTrade = titleMentions.some(item=>item.entity===mention.entity) &&
          /\b(?:buy|buying|sell|selling|wts|wtb|borrow|lend)\b|求购|求購|出售|想买|想買|出借|想借/.test(titleText);
        if (!trade && !titleTrade) continue;
      }

      const isLoan = /\b(?:borrow|borrowing|lend|lending|loan)\b|求借|借用|想借|出借/.test(context);
      // Mixed transactions and negated loan statements require clarification.
      const loanMissing = isLoan && /\b(?:sell|selling|buy|buying|sale|deposit|per day|daily|per hour)\b|押金|按天|每天|每日|每小时|每小時|不借|唔借|不出借/.test(context)
        ? ['loan-terms'] : [];
      const period = isLoan ? loanPeriod(context, post) : {};

      let price = priceConstraint(after, direction.side);
      if (price.price === undefined && !price.missing.length)
        price = priceConstraint(before, direction.side);
      if (
        price.price === undefined &&
        !price.missing.length &&
        source === post.title
      )
        price = priceConstraint(normalizeText(post.body), direction.side);
      if (
        price.price === undefined &&
        !price.missing.length &&
        /\bfree\b|免费|免費/.test(titleText) &&
        titleMentions.some((item) => item.entity === mention.entity)
      )
        price = { price: 0, missing: [] };
      let course =
        mention.entity === 'textbook'
          ? /\b([a-z]{3,5})[ -]?(\d{3,4}[a-z]?)\b/i.exec(context)
          : null;
      if (course && ['hkd', 'usd', 'isbn'].includes(course[1].toLowerCase()))
        course = null;
      const entity = course
        ? `textbook:${course[1].toUpperCase()}${course[2].toUpperCase()}`
        : mention.entity;
      if (isLoan && price.price === undefined && !price.missing.length &&
          /\b(?:lend|loan)\b.{0,100}\bfree from\b/.test(context) &&
          !/\b(?:not free|not for free)\b/.test(context)) price = {price:0,missing:[]};
      const constraints = additionalGoodsConstraints(context, post);
      if (isLoan && period.loanStart && period.loanEnd) {
        const start = new Date(period.loanStart);
        const local = new Date(start.getTime() + 8 * 3600000);
        constraints.date = local.toISOString().slice(0, 10);
        constraints.minute = local.getUTCHours() * 60 + local.getUTCMinutes();
        constraints.endMinute = undefined;
        constraints.missing = constraints.missing.filter(code => code !== 'handover_time_ambiguous');
      }

      const missing = [...price.missing, ...constraints.missing, ...loanMissing, ...(isLoan && !period.loanEnd ? ['loan-period'] : [])];
      if (price.price === undefined) missing.push('price');
      if (entity.startsWith('textbook') && /\b(?:not|no)\s+(?:english|chinese|print|paperback|digital)|不要(?:英文|中文|紙本|纸本|電子版|电子版)/.test(context)) missing.push('item-format','item-language');
      if (
        mention.entity === 'textbook' &&
        !course && !bookTitle(context) &&
        !/\bisbn\s*\d/i.test(context)
      )
        missing.push('book_identity');
      if (
        /wanted\s*\/\s*available|check which direction|not sure.{0,20}(?:sell|buy|direction)|方向.*(?:不确定|不確定)/.test(
          context,
        )
      )
        missing.push('side');
      if (
        /\b(?:maybe|might|may) (?:sell|available)|可能出|还没想好|還沒想好|没决定|未決定/.test(
          context,
        )
      )
        missing.push('availability');
      const { missing: _, ...details } = constraints;
      const thicknessMatches = entity === 'yoga-mat' ? [...context.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)/g)] : [];
      const thickness = thicknessMatches.length === 1 ? Number(thicknessMatches[0][1]) * (/^(cm|厘米)$/.test(thicknessMatches[0][2]) ? 10 : 1) : undefined;
      const minimumThickness = /\bat least\b|至少|最少|不低[于於]/.test(context);
      const thicknessUncertain = entity === 'yoga-mat' && (thickness === undefined || thickness <= 0 ||
        /\b(?:wide|width|long|length)\b|[寬宽長长]|[-−]\s*\d+(?:\.\d+)?\s*(?:mm|cm|毫米|厘米)/.test(context) ||
        /\b(?:not|around|about|approximately|at most|maximum)\b|不是|大約|大约|最多|[~–]/.test(context) ||
        (direction.side === 'seek' && !minimumThickness));
      if (thicknessUncertain) missing.push('item-thickness');
      const intent: MatchIntent = {
        kind: 'goods',
        entity,
        side: direction.side,
        ...(isLoan ? { transaction: 'loan' as const, ...period } : {}),
        price: price.price,
        model: modelConstraint(context, entity),
        ...(entity.startsWith('textbook') ? {
          itemFormat: /\b(?:print|printed|paperback|hardback)\b|紙本|纸本/.test(context) ? 'print' as const
            : /\b(?:ebook|e-book|digital|pdf)\b|电子版|電子版/.test(context) ? 'digital' as const : undefined,
          itemLanguage: /\benglish\b|英文/.test(context) ? 'english' : /\bchinese\b|中文/.test(context) ? 'chinese' : undefined,
        } : {}),
        ...(entity === 'yoga-mat' && !thicknessUncertain ? direction.side === 'offer' ? {thicknessMm:thickness} : {minimumThicknessMm:thickness} : {}),
        condition: conditionConstraint(context),
        ...details,
        evidence: [
          ...new Set([literal(post.title), literal(source)].filter(Boolean)),
        ],
        missing: [...new Set(missing)],
      };
      if (
        !results.some(
          (item) =>
            item.entity === intent.entity &&
            item.side === intent.side &&
            item.model === intent.model &&
            item.price === intent.price,
        )
      )
        results.push(intent);
    }
  }
  return results.slice(0, 12);
}


/** Canonicalize an already declared item identity without inventing a post or role. */
export function canonicalGoodsIdentity(value: string): {entity:string;model?:string} {
  const text=normalizeText(value).replace(/[_-]+/g,' ');
  const course=/^(?:textbook[: ]+)?([a-z]{3,5})[ -]?(\d{3,4}[a-z]?)(?: textbook)?$/i.exec(text);
  if (course && /textbook/i.test(text)) return {entity:`textbook:${course[1].toUpperCase()}${course[2].toUpperCase()}`};
  const entities=[...new Set(goodsMentions(text).map(item=>item.entity))];
  const entity=entities.length===1 ? entities[0] : normalizeText(value).trim();
  return {entity,model:modelConstraint(text,entity)};
}

export { hallField as canonicalHallName };
