import { openStudyTopic } from './open-study-topic.ts';
import { requestsCooperation } from './cooperation.ts';
import { canonicalHallName } from './housing-goods.ts';
import { studyFee } from './study-fee.ts';
import type { MatchIntent, MatchPost } from './types.ts';
import { extractSchedule, hasStrictTime, isCancelled, normalizeText } from './text.ts';

/** Canonical IDs are derived solely from text. A location tag is never a route origin. */
const PLACES: [string, RegExp][] = [
  ['campus-canteen-entrance', /\bcampus canteen main entrance\b|校[园園][饭飯]堂正[门門]/gi],
  ['campus-cafe-entrance', /\bcampus caf[eé] main entrance\b|校[园園]咖啡店正[门門]/gi],
  ['campus-sundial', /\b(?:campus )?sundial\b|日晷/gi],
  ['hkust-north-bus-stop', /\b(?:hkust\s*)?north bus stop\b|(?:科大)?北巴士站/gi],
  ['hong-kong-station', /\bhong kong station\b|香港站/gi],
  ['kowloon-station', /\bkowloon station\b|九[龙龍]站/gi],
  ['hkust-north-gate', /\b(?:hkust\s*)?north\s*gate\b|(?:科大)?北[门門]/gi],
  ['clear-water-bay-beach', /\bclear\s*water\s*bay\s*beach\b|清水[湾灣]海[滩灘]/gi],
  ['clear-water-bay-trail', /\bclear\s*water\s*bay\s*trail\b|清水[湾灣]步道/gi],
  ['athletics-track', /\b(?:(?:hkust|campus)\s+)?(?:athletics\s+)?track\b|(?:科大)?田[径徑][场場]/gi],
  ['climbing-wall', /\b(?:(?:hkust|campus)\s+)?climbing\s*wall\b|(?:科大)?攀[岩巖][墙牆]/gi],
  ['library', /\b(?:(?:hkust|campus|university)\s+)?library\b|(?:科大)?[图圖][书書][馆館]/gi],
  ['sports-center', /\b(?:(?:hkust|campus|university)\s+)?sports? cent(?:er|re)\b|[体體]育[馆館]|[运动運動]+中心/gi],
  ['seafront', /\b(?:(?:hkust|campus)\s+)?(?:seafront|waterfront)(?:\s+promenade)?\b|(?:科大)?海[边邊](?:[长長]廊)?|海[滨濱]/gi],
  ['lg7', /\b(?:hkust\s*)?lg\s*7\b|科大lg\s*7/gi], ['lg1', /\b(?:hkust\s*)?lg\s*1\b|科大lg\s*1/gi], ['atrium', /\batrium\b|露天[广廣][场場]/gi],
  ['hkust', /\b(?:hkust|ust|campus|hk\s*ust|university of science and technology)\b|香港科技大[学學]|科大|校[园園]|校[内內]/gi],
  ['airport', /\b(?:hong kong international airport|hkia|airport|hkg)\b|香港[国际際]+[机機][场場]|[机機][场場]|赤[鱲腊臘]角/gi],
  ['hang-hau', /\bhang\s*hau\b|坑口/gi],
  ['tseung-kwan-o', /\b(?:tseung\s*kwan\s*o|tko)\b|[将將][军軍][澳奥]/gi],
  ['mong-kok', /\bmon?g\s*kok\b|旺角/gi],
  ['kowloon-tong', /\bkowloon\s*tong\b|九[龙龍]塘/gi],
  ['choi-hung', /\bchoi\s*hung\b|彩虹/gi],
  ['diamond-hill', /\bdiamond\s*hill\b|[钻鑽]石山/gi],
  ['sai-kung-pier', /\bsai\s*kung pier\b|西[贡貢]碼頭|西[贡貢]码头/gi],
  ['sai-kung', /\bsai\s*kung\b|西[贡貢]/gi],
  ['central', /\bcentral\b|中[环環]/gi],
  ['admiralty', /\badmiralty\b|金[钟鐘]/gi],
  ['wan-chai', /\bwan\s*chai\b|[湾灣]仔/gi],
  ['causeway-bay', /\bcauseway\s*bay\b|[铜銅][锣鑼][湾灣]/gi],
  ['tsim-sha-tsui', /\b(?:tsim\s*sha\s*tsui|tst)\b|尖沙咀/gi],
  ['west-kowloon', /\b(?:hong kong\s+)?west\s*kowloon(?:\s+station)?\b|西九[龙龍](?:[高铁鐵站]+)?/gi],
  ['shenzhen', /\bshen\s*zhen\b|深圳/gi],
  ['lo-wu', /\b(?:lo\s*wu|luo\s*hu|luohu)\b|[罗羅]湖/gi],
  ['lok-ma-chau', /\blok\s*ma\s*chau\b|落[马馬]洲/gi],
  ['sha-tin', /\bsha\s*tin\b|沙田/gi],
  ['tai-po', /\btai\s*po\b|大埔/gi],
  ['yuen-long', /\byuen\s*long\b|元朗/gi],
  ['tuen-mun', /\btuen\s*mun\b|屯[门門]/gi],
  ['cityu', /\bcity\s*u\b|城大|城市大[学學]/gi],
  ['cuhk', /\bcuhk\b|中大|香港中文大[学學]/gi],
  ['hku', /\bhku\b|港大|香港大[学學]/gi],
];

type PlaceMention = { id: string; text: string; start: number; end: number };
function places(text: string): PlaceMention[] {
  const found: PlaceMention[] = [];
  for (const [id, pattern] of PLACES) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(new RegExp(pattern.source.replace(/\\b$/u, '(?![a-z])').replace(/\\b\|/gu, '(?![a-z])|'), pattern.flags))) {
      found.push({ id, text: match[0], start: match.index!, end: match.index! + match[0].length });
    }
  }
  return found.sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((p, i, all) => !all.slice(0, i).some(q => q.start <= p.start && q.end >= p.end));
}
function fullText(post: MatchPost) { return `${post.title}\n${post.body}`; }
function unique(items: string[]) { return [...new Set(items)]; }
function evidence(text: string, maxLength = 900) { return [text.trim().slice(0, maxLength)].filter(Boolean); }
function schedule(post: MatchPost, text?: string) {
  const result = extractSchedule(text === undefined ? post : { ...post, title: '', body: text });
  const missing: string[] = [];
  if (!result.date) missing.push('date');
  if (result.minute === undefined) missing.push('time');
  if (result.ambiguous) missing.push('schedule');
  return { date: result.date, minute: result.minute, endMinute: result.endMinute, strictTime: hasStrictTime(text === undefined ? fullText(post) : text) || result.endMinute !== undefined, missing };
}
const CN_NUMBER: Record<string, number> = { 零: 0, 一: 1, 壹: 1, 二: 2, 两: 2, 兩: 2, 俩: 2, 倆: 2, 贰: 2, 貳: 2, 三: 3, 叁: 3, 四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陆: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9, 十: 10 };
const EN_NUMBER: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };
const NUMBER = '(\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|a|an|[零一二两兩俩倆三四五六七八九十]{1,3})';
function numberOf(raw: string): number | undefined {
  const val = raw.toLowerCase();
  if (/^\d+$/.test(val)) return Number(val);
  if (val in EN_NUMBER) return EN_NUMBER[val];
  if (val.length === 1) return CN_NUMBER[val];
  const ten = val.indexOf('十');
  if (ten >= 0) return (ten === 0 ? 1 : CN_NUMBER[val[0]]) * 10 + (CN_NUMBER[val[ten + 1]] || 0);
}
function quantity(text: string, patterns: string[]): number | undefined {
  for (const pattern of patterns) {
    const found = text.match(new RegExp(pattern, 'iu'));
    if (found) return numberOf(found[1]);
  }
}

type Route = { from: string; to: string; fromExit?: string; toExit?: string; start: number; end: number };
function stationExit(text: string, mention: PlaceMention): string | undefined {
  const suffix = normalizeText(text.slice(mention.end,mention.end+45));
  const match = suffix.match(/^(?:\s*(?:station|站))?\s*(?:exit\s*([a-z]\d?|\d{1,2})\b|([a-z]\d?|\d{1,2})\s*出口)/);
  return (match?.[1] ?? match?.[2])?.toUpperCase();
}
function routes(text: string): Route[] {
  const mentions = places(text);
  const found: Route[] = [];
  for (let i = 0; i < mentions.length - 1; i++) {
    const a = mentions[i]; const b = mentions[i + 1];
    if (a.id === b.id || b.start - a.end > 100) continue;
    const gap = text.slice(a.end, b.start);
    if (/\n|[。!?！？]/.test(gap)) {
      // Explicit origin declarations may end a sentence before the destination.
      // Never carry an arbitrary location tag across a sentence boundary.
      const prefix = normalizeText(text.slice(Math.max(0,a.start-40),a.start));
      const declaredOrigin = /(?:實際出發係|实际出发是|出發地(?:係|是|為)|出发地(?:是|为)|\b(?:actual departure point|departing from|starting from)\s*(?:is|:)?)\s*$/.test(prefix);
      if (!declaredOrigin || (gap.match(/[。.!?！？]/g)||[]).length !== 1 ||
          /\n|\b(?:not|never|cancelled|canceled|instead)\b|不去|唔去|取消|改去/.test(gap.toLowerCase())) continue;
    }
    if (/(?:\b(?:to|towards?|into|bound for|heading to|going to)\b|[-=–—]*[>→➜]|去|到|往|返|出[发發][^。\n]*[到去往])/.test(gap.toLowerCase()) && !/\b(?:not|never)\s+to\b|不去|唔去|不是去/.test(gap.toLowerCase())) {
      found.push({ from: a.id, to: b.id, fromExit: stationExit(text,a), toExit: stationExit(text,b), start: a.start, end: b.end });
    } else if (/\bfrom\b|[由从從]/i.test(gap)) {
      found.push({ from: b.id, to: a.id, fromExit: stationExit(text,b), toExit: stationExit(text,a), start: a.start, end: b.end });
    }
  }
  return found.filter((p, i) => !found.slice(0, i).some(q => q.from === p.from && q.to === p.to && q.end === p.end));
}
function transportSide(text: string): MatchIntent['side'] | undefined {
  const t = normalizeText(text).replace(/(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/g, ' ')
    .replace(/\b(?:do(?:n'?t| not)|not|no longer|never)\s+(?:need|want|looking for|lookin for)\b.{0,35}\b(?:ride|lift|taxi|cab|driver)\b/g, '')
    .replace(/\b(?:not|never|can'?t|cannot|won'?t)\s+(?:be\s+)?driv(?:e|ing)\b/g, '')
    .replace(/(?:不|唔)(?:拼|夾|夹)(?:的士|出租|taxi|[车車])/g, '')
    .replace(/(?:不|唔|不会|不會)(?:[会會能想要])?(?:[开開揸]车|[开開揸]車)/g, '');
  // A hired taxi's passenger capacity does not make its passenger a driver.
  const hiredTaxi = /\b(?:taxi|cab|uber)\b|的士|出租[车車]/.test(t);
  const seekingTaxiCompanions = !/\b(?:not|never|no longer) (?:looking for|seeking)\b/.test(t) && /\bpassengers? booking a (?:taxi|cab)\b/.test(t) &&
    quantity(t,[`(?:looking for|seeking)\\s+(?:up to\\s+)?${NUMBER}\\s+more`]) !== undefined;
  const sharingTaxi = seekingTaxiCompanions || /\b(?:share|shared|sharing|split|splitting)\b|[拼夾夹]|分[摊攤]?車費|分[摊攤]?车费/.test(t);
  const selfDriving = /\b(?:i|we)\s+(?:will |can |am |are )?(?:drive|driving)\b|\bi'm driving\b|我[开開揸][车車]/.test(t);
  const refusesSharing = /\b(?:not|never|won't|will not|don't|do not) (?:share|sharing|split|splitting)\b|不拼|唔拼|不夾|唔夾/.test(normalizeText(text));
  if (hiredTaxi && sharingTaxi && !selfDriving) return refusesSharing ? undefined : 'share';
  if (/\b(?:need|looking for|lookin for|want)\s*(?:a\s*)?(?:driver|\d+\s*(?:spare\s*)?seats?)|(?:找|搵)[顺順][风風][车車]|找司[机機]|求.{0,35}(?:[顺順][风風][车車]|座位)|(?:想|要|需要).{0,20}搭[顺順][风風][车車]/.test(t)) return 'rider';
  if (/\b(?:i can drive|i(?:'m| am)? driving|driving|we(?:'re| are)? driving|driving from|drive[rs]? offer|offering (?:a )?(?:ride|lift)|(?:spare|empty|free|available|availble)\s*(?:passenger\s*)?seats?|seats? (?:available|availble|free)|can (?:give|offer) (?:you )?(?:a )?(?:ride|lift)|room for)\b|我[开開揸][车車]|[开開揸][车車].{0,8}[空有][个位個位]|[顺順][风風][车車].{0,8}[空余餘位]|(?:提供|可[带帶])(?:[顺順][风風][车車]|接送)|(?:有|剩)?\s*[\d一二两兩三四五六七八九]+\s*[个個]?(?:空|乘客座)位|[开開揸][车車]/.test(t)) return 'driver';
  if (/\b(?:need(?:s|ing)?|looking for|lookin for|seeking|want(?:ing)?|could use)\b.{0,28}\b(?:ride|lift|driver)\b|\b(?:ride|lift)\s*(?:pls|please|needed|wanted)|\b(?:ride|lift)\s+for\s+\d|求(?:搭|[顺順][风風])?[车車]|想搭[顺順][风風][车車]|需要.{0,8}(?:接送|搭[车車])|求[带帶]|求[顺順][风風][车車]|找司[机機]|求.{0,10}(?:座位|\d+位)|需要\s*\d+\s*[个個]?(?:座位|位)|[一-鿿]*人.{0,12}(?:要|想).{0,12}[车車]/.test(t)) return 'rider';
  if (/\b(?:share|sharing|split|splitting|join)\b.{0,80}\b(?:taxi|cab|uber|ride|car)\b|\b(?:taxi|cab|uber)\b.{0,80}\b(?:share|sharing|split|together)\b|\bcarpool(?:ing)?\b|[拼夾夹][车車]|拼出租|[夾夹].{0,12}(?:的士|taxi)|拼(?:的士|taxi)|(?:anyone sharing|share a|sharing from)|一[齐齊起].{0,6}(?:的士|taxi)|分[摊攤].{0,6}[车車][费費]/.test(t)) return 'share';
}
function transportCounts(text: string, side: MatchIntent['side']): { party?: number; seats?: number; capacity?: number } {
  const t = normalizeText(text).replace(/(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/g, ' ');
  let party = quantity(t, [
    `(?:we(?:'re| are)|我[们們哋])\\s*${NUMBER}(?:\\s*(?:人|[个個]|people|ppl))?(?![a-z])`,
    `(?:need(?:ing)?|lift|ride|for)\\s*(?:a\\s*)?(?:lift|ride)?\\s*for\\s*${NUMBER}(?![a-z])`,
    `(?:need|want)\\s*${NUMBER}\\s*seats?`,
    `${NUMBER}\\s*(?:students?|companions?)\\b`,
    `${NUMBER}\\s*[个個]?人`,
    `(?:there (?:are|is)|we(?:'re| are)|party of|group of|for|us|total(?: of)?|共|一共|我[们們哋])\\s*${NUMBER}\\s*(?:of us|people|persons?|passengers?|ppl|人|[个個](?!位))`,
    `${NUMBER}\\s*(?:of us|people|persons?|ppl|passengers?|[个個]?人)(?:\\b|[，,。\\s]|$)`,
    `(?:need|want|looking for|求|要|需要)\\s*${NUMBER}\\s*(?:seats?|[个個]?(?:座)?位)`,
    `(?:我[们們哋]|共|一共)\\s*${NUMBER}\\s*[个個人](?!位)`,
  ]);
  if (party === undefined && /\b(?:just me|just myself|solo|alone|only me|no companions)\b|我一[个個]人|得我一[个個]|自己一[个個]|一人出[发發]/.test(t)) party = 1;
  if (party === undefined && /\b(?:me and (?:a|one|my) friend|my friend and (?:i|me)|the two of us|both of us)\b|我[们們哋][两兩俩倆][个個]?|我[和同]朋友[两兩]人/.test(t)) party = 2;
  const seats = quantity(t, [
    `${NUMBER}\\s*(?:(?:spare|empty|free|available|availble|remaining)\\s*)?(?:passenger\\s*)?seats?\\s*(?:available|availble|free|left|remaining|spare|empty|[.,;!]|$)`,
    `(?:have|got|with|offering|offer|room for|can take|有|剩|[还還]有)\\s*${NUMBER}\\s*(?:spare |free |empty )?(?:seats?|people|persons?|ppl|passengers?|[个個]?(?:空|[余餘])?位|人)`,
    `${NUMBER}\\s*(?:spare|empty|free|available|availble)\\s*(?:passenger\\s*)?seats?`,
    `${NUMBER}\\s*[个個]?(?:空|乘客座|乘客|剩[余餘])位`,
  ]);
  const capacity = quantity(t, [
    `(?:taxi|cab) with (?:exactly )?${NUMBER} passenger seats?`,
    `(?:capacity(?: of| is|:)?|max(?:imum)?(?: of)?|最多(?:坐)?|限坐|可坐|[总總]共(?:可坐)?)\\s*${NUMBER}\\s*(?:people|persons?|passengers?|ppl|人|位)?`,
    `${NUMBER}[ -]?(?:passenger|seater|seat)\\s*(?:taxi|cab|uber|car)`,
    `${NUMBER}\\s*(?:人座|客座|乘客座位|座位|座).{0,6}(?:的士|出租|taxi|cab|车|車)`,
  ]);
  return { ...(side === 'driver' ? { seats } : { party }), ...(side === 'share' ? { capacity } : {}) };
}

function transportDetails(source: string, side: MatchIntent['side'], party?: number): Partial<MatchIntent> & {missing:string[]} {
  const text = normalizeText(source);
  const details: Partial<MatchIntent> & {missing:string[]} = {missing:[]};
  if (/\b(?:free (?:lift|ride)|ride for free|no fare|no charge)\b|免費|免费/.test(text) &&
      !/\bnot free\b|不免费|不免費/.test(text)) details.fee={amount:0};
  else if (/\b(?:hkd|usd|cny)\s*\d|(?:hk|us)\$|\b(?:fare cap|budget|charge|paid ride)\b|每人最多|收[费費]/.test(text)) {
    const quote = studyFee(text, side === 'driver' ? 'offer' : 'seek');
    const eachFare = /\b(?:hkd|usd|cny)\s*\$?\s*\d+(?:\.\d{1,2})?\s+each\b(?!\s+(?:bag|backpack|suitcase|item|trip|way)\b)|\b(?:hk|us)\$\s*\d+(?:\.\d{1,2})?\s+each\b(?!\s+(?:bag|backpack|suitcase|item|trip|way)\b)/.test(text);
    const perPerson = /\bper (?:person|passenger)\b|每人/.test(text) || eachFare;
    const total = /\b(?:total|per party)\b|合共|总共|總共/.test(text);
    if (quote.fee && !quote.fee.basis && !quote.missing.length && perPerson !== total) {
      details.fee = {...quote.fee,basis:perPerson?'person':'party'};
    } else details.missing.push('fare');
  }
  if (details.fee?.amount === 0 && /\b(?:hkd|usd|cny)\s*\d|(?:hk|us)\$|额外|額外|\bextra\b/.test(text)) details.missing.push('fare');
  const noBaggage = side === 'driver'
    ? /\bno (?:luggage|baggage) allowed\b|不允許帶行李|不允许带行李/g
    : /\b(?:no (?:luggage|baggage)|without (?:luggage|baggage))\b|不帶行李|不带行李/g;
  if (noBaggage.test(text)) {
    const remaining = text.replace(noBaggage, '');
    // A second baggage statement may qualify or contradict the zero claim.
    if (/\b(?:bags?|backpacks?|suitcases?|luggage|baggage|handbags?)\b|背包|行李|手袋|小袋/.test(remaining) ||
        /\b(?:not|maybe|perhaps|possibly)\s+(?:no|without)\b/.test(text)) {
      details.missing.push('luggage');
    } else if (side === 'driver') {
      details.luggageLimit = 0;
      details.luggageLimitKind = 'any';
    } else {
      details.luggage = 0;
    }
    return details;
  }
  const smallBagCount = quantity(text,[`${NUMBER}\\s*(?:[个個]\\s*)?(?:small (?:handbags?|bags?)|小(?:手袋|袋))`]);
  const smallBag = /\bsmall (?:handbags?|bags?)\b|小(?:手袋|袋)/.test(text);
  const otherBag = /\b(?:backpacks?|suitcases?|luggage)\b|背包|行李/.test(text);
  if (smallBag && !otherBag) {
    if (side === 'driver') {
      if (smallBagCount !== undefined && /\b(?:can fit|can take|space for|only)\b|可放|最多|只可[帶带]/.test(text)) {
        details.luggageLimit=smallBagCount;details.luggageLimitKind='small-bag';
        if (/\bonly\b|只可[帶带]/.test(text)) details.allowedLuggageKinds=['small-bag'];
      } else details.missing.push('luggage');
    } else {
      const each=/\beach\b|各|每人/.test(text);
      if (smallBagCount !== undefined && (!each || party !== undefined)) {
        details.luggage=smallBagCount*(each?party!:1);details.luggageKind='small-bag';
      } else details.missing.push('luggage');
    }
    return details;
  }
  const baggage = /\b(?:backpacks?|suitcases?|luggage|handbag)\b|背包|行李|小袋/.test(text);
  if (side === 'driver' && baggage) {
    const limit=quantity(text,[`(?:can fit|can take|space for|可放|最多(?:可放)?|只可帶|只可带)\\s*${NUMBER}\\s*(?:[个個]\\s*)?(?:small |小)?(?:backpacks?|背包)`, `${NUMBER}\\s*(?:small )?backpacks?\\s+allowed\\b`]);
    const personalLimit=quantity(text,[`每人\\s*${NUMBER}\\s*[个個]?(?:小)?背包`, `${NUMBER}\\s*(?:small )?backpacks?\\s+per (?:person|passenger)`]);
    if(personalLimit!==undefined){details.luggageLimit=personalLimit;details.luggageLimitKind='backpack';details.luggageLimitBasis='person';details.luggageTotalLimit=limit;
      if (/\b(?:suitcases?|luggage|handbags?)\b|行李|小袋|\b(?:not|no|except)\b|不接受|唔接受/.test(text)) details.missing.push('luggage');
      return details;
    }
    if(limit!==undefined){details.luggageLimit=limit;details.luggageLimitKind='backpack';}
    else if (/\bbackpacks? only\b|只(?:可|能)?[带帶]背包/.test(text)) details.allowedLuggageKinds=['backpack'];
    else details.missing.push('luggage');
  } else if (baggage) {
    const count=quantity(text,[`${NUMBER}\\s*(?:[个個]\\s*)?(?:small |小)?(?:backpacks?|背包)`]);
    const each=/\beach\b|各|每人/.test(text);
    if(count!==undefined && (!each||party!==undefined)) {
      details.luggage=count*(each?party!:1);details.luggageKind='backpack';
      if(each || party===1) details.luggagePerPerson=count;
    }
    if (/\b(?:suitcase|luggage|handbag)\b|行李|小袋/.test(text)) details.missing.push('luggage');
  }
  return details;
}

function parseTransportSection(post: MatchPost): MatchIntent[] {
  const text = fullText(post);
  if (isCancelled(text)) return [];
  const directional = routes(text);
  const globalSide = transportSide(post.body) ?? transportSide(text);
  if (!globalSide) return [];
  const entries: { route?: Route; text: string }[] = directional.length <= 1
    ? [{ route: directional[0], text }]
    : directional.map((route, i) => ({ route, text: text.slice(i === 0 ? 0 : Math.max(text.lastIndexOf('\n', route.start) + 1, route.start - 40), directional[i + 1]?.start ?? text.length) }));
  return entries.map(entry => {
    const side = entries.length === 1 ? globalSide : transportSide(entry.text) ?? globalSide;
    const timing = schedule(post, entries.length === 1 ? undefined : entry.text);
    const counts = transportCounts(entry.text, side);
    const {missing: detailMissing, ...details} = transportDetails(entry.text, side, counts.party);
    const soughtPartyMax = side === 'share' ? quantity(normalizeText(entry.text),[
      `(?:想找|想搵|再找|再搵)\\s*${NUMBER}\\s*人`,
      `(?:looking for|seeking)\\s+(?:up to\\s+)?${NUMBER}\\s+more`,
    ]) : undefined;
    const missing = [...timing.missing, ...detailMissing];
    if (!entry.route) missing.push('from', 'to');
    if (side === 'driver' && counts.seats === undefined) missing.push('seats');
    if (side !== 'driver' && counts.party === undefined) missing.push('party');
    if (side === 'share' && counts.capacity === undefined) missing.push('capacity');
    return {
      kind: 'transport', entity: entry.route ? `${entry.route.from}>${entry.route.to}` : 'unknown-route', side,
      from: entry.route?.from, to: entry.route?.to, fromExit: entry.route?.fromExit, toExit: entry.route?.toExit, date: timing.date, minute: timing.minute,
      endMinute: timing.endMinute, strictTime: timing.strictTime, ...counts, ...details, soughtPartyMax, evidence: evidence(entry.text), missing: unique(missing),
    };
  });
}

function communication(text: string): string | undefined {
  const t = normalizeText(text).replace(/(?<=[a-z])(?=\d)/g, ' ');
  if (/\b(?:any language|any lang|language doesn'?t matter|english or chinese|chinese or english)\b|中英(?:文|语|語)?(?:都|均|皆)?可|[语語]言不限|[乜咩]文都得/.test(t)) return 'any';
  const languages = [
    ['english', /\b(?:english|eng)\b|英[语語文]/],
    ['cantonese', /\b(?:cantonese|canto)\b|[粤粵][语語]|[广东東]+[话話]|[广廣][东東][话話]/],
    ['mandarin', /\b(?:mandarin|putonghua)\b|普通[话話]|[国國][语語]/],
    ['chinese', /\bchinese\b|中文|[汉漢][语語]/],
    ['korean', /\bkorean\b|[韩韓][语語文]/],
    ['japanese', /\bjapanese\b|日[语語文]/],
    ['french', /\bfrench\b|法[语語文]/],
  ] as const;
  const specified = languages.filter(([, re]) => {
    const occurrences = [...t.matchAll(new RegExp(re.source, 'g'))];
    return occurrences.some(m => {
      const before = t.slice(Math.max(0, m.index! - 100), m.index);
      const denied = /(?:\b(?:no|not|except|without)\s+|\b(?:cannot|can'?t|couldn'?t|do not|don'?t)\s+(?:(?:communicate|speak|teach|tutor|explain|understand|follow|use|learn|study)(?:\s+(?:fluently|well))?\s+)?(?:(?:in|using)\s+)?|听不懂|聽唔明|不(?:用|要|会|會)|唔(?:用|要|識)|非)\s*$/.test(before);
      return !denied;
    });
  }).map(([name]) => name);
  return specified.length ? unique(specified).sort().join('|') : undefined;
}
function studySide(text: string): MatchIntent['side'] | undefined {
  const t = normalizeText(text)
    .replace(/\b(?:do(?:n'?t| not)|not|no longer|never)\s+(?:need|want|looking for|lookin for|seeking)\b[^.;。；]*/g, '')
    .replace(/(?:不是|不|唔)(?:求|找|搵|要|需要)[^。；;.]*/g, '')
    .replace(/\b(?:cannot|can'?t|not)\s+(?:teach|tutor|explain|coach)[^.;。；]*/g, '')
    .replace(/(?:不会|不會|唔識|不能)(?:教|[讲講])[^。；;.]*/g, '');
  if (/\b(?:needs?|want|looking for|lookin for|seeking|find)\b.{0,65}\b(?:tutor(?:ing)?|mentor|teacher|explanation|explain|help)\b|\b(?:can|could) (?:someone|anyone|somebody)\b.{0,25}\b(?:teach|explain|help)\b|\b(?:i(?:'m| am) (?:lost|struggling)|tutor wanted|tutor needed|teach me)\b|(?:想|要)?(?:找|搵)(?:别人|別人|人).{0,14}(?:[讲講]|教)|(?:找|搵)老[师師]|求.{0,35}(?:教|[辅輔][导導]|[讲講]解|[补補][习習])|需要.{0,35}(?:[辅輔][导導]|[讲講]|[补補][习習]|[帮幫]忙)|想有人教|希望有人教|救救|教下我/.test(t)) return 'seek';
  if (/\b(?:i can|can|happy to|willing to|offering to|available to)\s+(?:help|explain|teach|tutor|mentor|coach)\b|\b(?:offering|offer)\b.{0,65}\b(?:tutoring|tuition|help|mentoring)\b|\b(?:tutor|tutoring)\s+(?:available|offered)|\bi (?:teach|tutor)\b|(?:我)?(?:可以|能|可).{0,10}(?:[帮幫]忙[讲講]解|教|[讲講]|[辅輔][导導])|(?:提供|可做|可提供|能做).{0,45}(?:[补補][习習]|[辅輔][导導]|[讲講]解)|我教|[帮幫]你[讲講]/.test(t)) return 'offer';
  if (/\b(?:want|seeking|looking for) (?:another|a fellow) learner to (?:work through|practice|study|review)\b/.test(t)) return 'peer';
  if (/\b(?:seeking|looking for|want|need) (?:a |one )?peer\b.{0,65}\b(?:practice|practise|review|revise|study|learn)\b/.test(t)) return 'peer';
  if (/\b(?:peer (?:flashcard |revision |study )?practice|learners (?:reviewing|practicing|revising)|more peers? welcome)\b/.test(t)) return 'peer';
  if (/\b(?:revision|study|studying|practice|learning|project|assignment|homework)\s+(?:buddy|buddies|partner|partners|group|together)|\b(?:revise|review|study|practice|learn)\s+(?:it\s+)?together|\b(?:study sesh|study session|problem sets? together|peer study|peer session|peers taking turns)|[温溫][书書]伴|一[齐齊起].{0,12}(?:[复複][习習]|[温溫][书書]|[学學][习習]|做[题題]|练[题題]|[读讀][书書])|(?:[学學][习習]|[复複][习習]|[温溫][书書])(?:搭子|同伴|伙伴|[伙夥]伴|小[组組]|伴)|[组組][队隊].{0,15}(?:作[业業]|[学學][习習])|相互反[馈饋]|互相反[馈饋]|一起刷[题題]|一[齐齊起]練(?:習|\s|[a-z電电積积])|(?<!不)互相[練练](?:習|习|\s|[a-z口听聽阅閱讀读写寫])|互相對下/.test(t)) return 'peer';
  if (requestsCooperation(text, 'study')) return 'peer';
}
function studyEntities(text: string): { entity: string; start: number; end: number }[] {
  const courses = [...text.matchAll(/\b([A-Za-z]{2,8})\s*[-_]?\s*(\d{3,5}[A-Za-z]?)\b(?![-/]\d)/g)]
    .filter(m => !['HKD', 'USD', 'JAN', 'JANUARY', 'FEB', 'FEBRUARY', 'MAR', 'MARCH', 'APR', 'APRIL', 'MAY', 'JUN', 'JUNE', 'JUL', 'JULY', 'AUG', 'AUGUST', 'SEP', 'SEPT', 'SEPTEMBER', 'OCT', 'OCTOBER', 'NOV', 'NOVEMBER', 'DEC', 'DECEMBER', 'YEAR', 'HALL', 'ROOM', 'BUS', 'FLIGHT', 'ON', 'AT', 'IN', 'FROM', 'UNTIL', 'BEFORE', 'AFTER'].includes(m[1].toUpperCase()))
    .map(m => ({ entity: `${m[1]}${m[2]}`.toUpperCase(), start: m.index!, end: m.index! + m[0].length }));
  if (courses.length) return courses;
  const topics: [string, RegExp][] = [
    ['ielts', /\bielts\b|雅思/gi], ['toefl', /\btoefl\b|托福/gi],
    ['calculus', /\bcalculus\b|微[积積]分/gi], ['linear-algebra', /\blinear algebra\b|[线線]性代数|[线線]性代數/gi],
    ['statistics', /\bstatistics\b|[统統][计計][学學]?/gi], ['python', /\bpython\b/gi],
    ['java', /\bjava\b/gi], ['cpp', /\bc\+\+/gi], ['machine-learning', /\bmachine learning\b|[机機]器[学學][习習]/gi],
    ['data-structures', /\bdata structures?\b|数据结构|數據結構/gi], ['economics', /\beconomics\b|[经經][济濟][学學]/gi],
  ];
  return topics.flatMap(([entity, re]) => [...text.matchAll(re)].map(m => ({ entity, start: m.index!, end: m.index! + m[0].length })));
}

const STUDY_TOPICS: [string, RegExp][] = [
  ['speaking', /\bspeaking\b|口[语語]/gi],
  ['writing', /\bwriting\b|[写寫]作/gi],
  ['listening', /\blistening\b|[听聽]力/gi],
  ['reading', /\breading\b|[阅閱][读讀]/gi],
  ['chemical-bonding', /\bchemical bonding\b|化[学學][键鍵]/gi],
  ['recursion', /\brecurs(?:ion|ive)\b|[递遞][归歸迴回]/gi],
  ['pointers', /\bpointers?\b|指[针針標]/gi],
  ['references', /\breferences?\b|引[用述]/gi],
  ['linked-lists', /\blinked[ -]?lists?\b|[链鏈][表錶]|連結串列/gi],
  ['lists', /\blists?\b|列表|串列/gi],
  ['arrays', /\barrays?\b|[数數][组組]|陣列/gi],
  ['binary-trees', /\bbinary trees?\b|二叉[树樹]|二元[树樹]/gi],
  ['trees', /\btrees?\b|[树樹][结結][构構]/gi],
  ['graphs', /\bgraph(?:s| theory)?\b|[图圖][论論]|[图圖][结結][构構]/gi],
  ['sorting', /\bsort(?:ing)?(?: algorithms?)?\b|排序(?:算法)?/gi],
  ['searching', /\bsearch(?:ing)? algorithms?\b|搜[寻尋索]算法|查找算法/gi],
  ['binary-search', /\bbinary search\b|二分(?:查找|搜[寻尋索])/gi],
  ['hash-tables', /\bhash(?:ing|[ -]?(?:tables?|maps?))\b|哈希|雜湊|散列表/gi],
  ['stacks', /\bstacks?\b|堆[栈棧]|[栈棧]/gi],
  ['queues', /\bqueues?\b|[队隊]列|佇列/gi],
  ['dynamic-programming', /\bdynamic programming\b|[动動][态態][规規][划劃]/gi],
  ['object-oriented-programming', /\b(?:object[ -]oriented(?: programming)?|oop)\b|面向[对對]象|物件[导導]向/gi],
  ['inheritance', /\binheritance\b|[继繼]承/gi],
  ['polymorphism', /\bpolymorphism\b|多[态態]/gi],
  ['functions', /\bfunctions?\b|函[数數]/gi],
  ['loops', /\bloops?\b|[循迴]环|循環|迴圈/gi],
  ['limits', /\blimits?\b|[极極]限/gi],
  ['derivatives', /\b(?:derivatives?|differentiation)\b|[导導][数數]|微分/gi],
  ['integration', /\b(?:integration|integrals?|integrating)\b|(?<!微)[积積]分/gi],
  ['differential-equations', /\bdifferential equations?\b|微分方程/gi],
  ['matrices', /\bmatri(?:x|ces)\b|矩[阵陣]/gi],
  ['vectors', /\bvectors?\b|向量/gi],
  ['eigenvalues', /\beigenvalues?\b|特[征徵]值/gi],
  ['probability', /\bprobabilit(?:y|ies)\b|概[率律]|[机機]率/gi],
  ['distributions', /\b(?:probability |normal |binomial |poisson )?distributions?\b|概率分布|[机機]率分[布佈]|正[态態]分[布佈]/gi],
  ['hypothesis-testing', /\bhypothes(?:is|es) testing\b|假[设設][检檢][验驗]/gi],
  ['regression', /\b(?:linear |logistic )?regression\b|[线線]性回[归歸]|回[归歸]分析/gi],
  ['bonds', /\bbonds?(?: valuation| pricing)?\b|[债債]券(?:估值|定[价價])?/gi],
  ['valuation', /\bvaluation\b|估值/gi],
  ['present-value', /\b(?:net )?present value|\bnpv\b|[净淨]?[现現]值/gi],
  ['options', /\boptions?(?: pricing)?\b|期[权權]/gi],
  ['presentation', /\bpresentations?\b|演[讲講]|[汇彙][报報]|匯報|口[头頭][报報]告/gi],
  ['pronunciation', /\bpronunciation\b|[发發]音/gi],
  ['academic-writing', /\bacademic writing\b|[学學][术術][写寫]作/gi],
  ['essay-writing', /\bessay(?: writing)?\b|[论論]文[写寫]作/gi],
];
function studyTopics(text: string, side: MatchIntent['side']): { topics?: string[]; requiredTopics?: string[]; missing: string[] } {
  const matches = STUDY_TOPICS.flatMap(([topic, re]) => [...text.matchAll(re)].map(m => ({ topic, start: m.index!, end: m.index! + m[0].length })))
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((a, i, all) => !all.slice(0, i).some(b => b.start <= a.start && b.end >= a.end));
  const accepted = matches.filter(m => {
    const before = normalizeText(text.slice(Math.max(0, m.start - 70), m.start));
    const after = normalizeText(text.slice(m.end, m.end + 45));
    return !/(?:\b(?:not|no|except|instead of|already (?:know|understand)|covered)\s*(?:(?:teaching|learning|studying|help with|need help with|teach|learn|cover|on|about|with)\s*)?|不是|不要|不[讲講教]|不用[学學]|唔[讲講教]|已[经經](?:懂|[学學][过過]|[学學][会會]))$/.test(before)
      && !/^(?:\s*[,，:]?\s*)(?:i already (?:know|understand)|不用[学學]|已[经經](?:懂|[学學][会會]))/.test(after);
  });
  let topics = unique(accepted.map(m => m.topic));
  // A broad programming language is not evidence of a particular concept.
  // Only retain it as the topic when no narrower concept is explicitly named.
  if (!topics.length) {
    const broad: [string, RegExp][] = [['python', /\bpython\b/i], ['cpp', /\bc\+\+/i], ['java', /\bjava\b/i], ['calculus', /\bcalculus\b|微[积積]分/i], ['linear-algebra', /\blinear algebra\b|[线線]性代[数數]/i]];
    topics = broad.filter(([, re]) => re.test(text)).map(([topic]) => topic);
  }
  const t = normalizeText(text);
  const mustAll = side !== 'offer' && /\b(?:need|must|require|want)\b.{0,25}\b(?:both|all)\b|\b(?:both|all)\b.{0,25}\b(?:required|essential|must)\b|必须.{0,12}(?:都|全部)|[两兩]个都|全部都要/.test(t);
  const restrictiveUnknown = !topics.length && /\b(?:only (?:teach|explain|cover|learn|study)|(?:teach|explain|cover|learn|study) only|focus(?:ing)?(?: only)? on|specific topic)\b|只(?:[讲講教]|[学學]|[复複][习習])|指定(?:主[题題]|[内內]容)/.test(t);
  return { topics: topics.length ? topics : undefined, requiredTopics: mustAll && topics.length ? topics : undefined, missing: restrictiveUnknown ? ['topic'] : [] };
}
function studyMeetingPlaces(text: string): { places: string[]; missing: string[] } {
  const mentions = places(text).filter(m => {
    const before = normalizeText(text.slice(Math.max(0, m.start - 60), m.start));
    const after = normalizeText(text.slice(m.end, m.end + 35));
    if (/(?:\b(?:not|except|cannot|can'?t|unable to)\s*(?:at|in|near|go to|meet at)?\s*|不是|不在|不去|唔去|唔喺)$/.test(before) || /^(?:不行|除外|不可|没空|冇空)/.test(after)) return false;
    if (/\b(?:currently|right now|posting from)\b[^.;。；]*$|(?:人在|正喺|正在)[^。；]*$/.test(before)) return false;
    if (m.id === 'hkust') return /\b(?:at|in|on|near|meet(?: at| in)?|face[ -]to[ -]face at)\s*$|(?:在|喺|去|[约約])$/.test(before) || /^(?:[见見]|面[授谈談]|[线線]下)/.test(after);
    return true;
  });
  const onlineMentions = [...text.matchAll(/\b(?:online|remote(?:ly)?|zoom|google meet|microsoft teams|video call|over video)\b|[线線]上|[远遠]程|[网網]上(?:[讲講教]|[见見])|[视視][频頻][通话話]+/gi)].filter(m => {
    const before = normalizeText(text.slice(Math.max(0, m.index! - 45), m.index));
    const after = normalizeText(text.slice(m.index! + m[0].length, m.index! + m[0].length + 35));
    return !/(?:\b(?:not|no|cannot|can'?t|unable to)\s*(?:do|use|meet|study)?\s*|不(?:能|要|做|接受|用)?|唔(?:要|用|做)?)$/.test(before)
      && !/^(?:\s*(?:lectures?|recordings?|videos?|textbooks?|course materials?))\b|^(?:[课課]程|[课課]|[视視][频頻])/.test(after);
  });
  const values = unique(mentions.map(m => m.id));
  const t = normalizeText(text);
  if (onlineMentions.length) {
    const options = /\b(?:either|or|both|also available in person|in person also)\b|[线線]上[线線]下都|[线線]上或|或者|都(?:可以|可|得)/.test(t);
    return { places: options && values.length ? unique(['online', ...values]) : ['online'], missing: [] };
  }
  if (values.length > 1 && !/\b(?:either|or|both)\b|或者|或|都(?:可以|可|得)/.test(t)) return { places: [], missing: ['place'] };
  if (values.length) return { places: values, missing: [] };
  const unknown = /\bmeet(?:ing)?\s+(?:only\s+)?(?:at|in|near)\s+|\b(?:venue|location)\s*(?:undecided|unknown|tbd)|[地场場][点點地]未定|[见見]面地[点點]|(?:[约約]在|喺).{1,20}(?:[见見]|上[课課])/.test(t);
  return { places: [], missing: unknown ? ['place'] : [] };
}
function parseStudySection(post: MatchPost): MatchIntent[] {
  const text = fullText(post);
  if (isCancelled(text)) return [];
  const bodyCourses = studyEntities(post.body);
  const found = bodyCourses.length ? bodyCourses.map(c => ({...c, start:c.start + post.title.length + 1, end:c.end + post.title.length + 1})) : studyEntities(text);
  const overallSide = studySide(post.body) ?? studySide(text);
  if (!overallSide) return [];
  const timing = schedule(post);
  const language = communication(text);
  if (!found.length) {
    const topicDetails = studyTopics(post.body || text, overallSide);
    const meeting = studyMeetingPlaces(post.body || text);
    return (meeting.places.length ? meeting.places : [undefined]).map(place => ({
      kind: 'study', entity: openStudyTopic(post.body) ?? openStudyTopic(text) ?? 'unknown-course', side: overallSide, place,
      topics: topicDetails.topics, requiredTopics: topicDetails.requiredTopics,
      date: timing.date, minute: timing.minute, endMinute: timing.endMinute,
      strictTime: timing.strictTime, communication: language, evidence: evidence(text),
      missing: unique([...timing.missing, ...topicDetails.missing, ...meeting.missing, 'course', ...(language ? [] : ['communication'])]),
    }));
  }
  const intents: MatchIntent[] = [];
  for (const course of found) {
    const leading = normalizeText(text.slice(Math.max(0, course.start - 30), course.start));
    if (/(?:\b(?:not|no|except|instead of)|不是|不要|唔要|唔係)\s*$/.test(leading)) continue;
    // Contrast and semicolon boundaries let each explicit intent keep its own role.
    const before = text.slice(0, course.start);
    const after = text.slice(course.end);
    const left = Math.max(before.lastIndexOf(';'), before.lastIndexOf('；'), before.lastIndexOf('\n\n'), [...before.matchAll(/\bbut\b|另外|同时|同時/gi)].at(-1)?.index ?? -1);
    const stop = after.search(/;|；|\n\n|\bbut\b|另外|同时|同時/i);
    const local = text.slice(left + 1, stop < 0 ? text.length : course.end + stop);
    const localBody = post.title && local.startsWith(post.title + '\n') ? local.slice(post.title.length + 1) : local;
    const side = studySide(localBody) ?? overallSide;
    const localLanguage = communication(local) ?? language;
    const payment = studyFee(local, side);
    const seats = side === 'peer' ? quantity(local.toLowerCase(), [`${NUMBER} more peers? welcome`, `(?:还有|還有|仲有)${NUMBER}(?:个|個)?(?:空位|名额|名額)`]) : undefined;
    const party = side === 'peer' ? quantity(local.toLowerCase(), [`${NUMBER}\\s+(?:[a-z]{2,8}\\s*\\d{3,5}\\s+)?students? (?:hoping|looking|wanting) to join`]) : undefined;

    const localTiming = schedule(post, local);
    const hasLocalSchedule = localTiming.date !== undefined && localTiming.minute !== undefined;
    const chosenTiming = hasLocalSchedule ? localTiming : timing;
    const topicDetails = studyTopics(localBody, side);
    const localMeeting = studyMeetingPlaces(localBody);
    const globalMeeting = studyMeetingPlaces(post.body);
    const sharedVenue = new Set(found.map(c => c.entity)).size === 1 || /\b(?:both|all)\s+(?:sessions?|courses?|meetings?)\b|都在|都喺|全部.{0,6}(?:在|喺)/.test(normalizeText(post.body));
    const meeting = localMeeting.places.length || localMeeting.missing.length ? localMeeting : sharedVenue ? globalMeeting : { places: [], missing: [] };
    const intent: MatchIntent = { kind: 'study', entity: course.entity, side, seats, party, fee: payment.fee,
      topics: topicDetails.topics, requiredTopics: topicDetails.requiredTopics,
      date: chosenTiming.date, minute: chosenTiming.minute, endMinute: chosenTiming.endMinute, strictTime: chosenTiming.strictTime,
      communication: localLanguage, evidence: evidence(local),
      missing: unique([...chosenTiming.missing, ...payment.missing, ...topicDetails.missing, ...meeting.missing, ...(localLanguage ? [] : ['communication'])]),
    };
    for (const place of meeting.places.length ? meeting.places : [undefined]) {
      const located = { ...intent, place };
      if (!intents.some(i => i.entity === located.entity && i.side === located.side && i.date === located.date && i.minute === located.minute && i.place === located.place)) intents.push(located);
    }
  }
  return intents;
}

const ACTIVITIES: [string, RegExp][] = [
  ['board-game:catan', /\bcatan\b|卡坦[岛島]?/gi],
  ['board-game:carcassonne', /\bcarcassonne\b|卡卡[颂頌]/gi],
  ['board-game:codenames', /\bcodenames\b|機密代號|机密代号/gi],
  ['photo-walk', /\b(?:photo[ -]?walk|(?:phone )?photography walk)\b|散步拍照|拍照散步|攝影散步|摄影散步/gi],
  ['walking', /\b(?:walk|walking|stroll)\b|散步|走走|沿海旁行|(?:連續|连续)行\d+分[鐘钟]/gi],
  ['beach-cleanup', /\b(?:beach clean[ -]?up|clean litter|litter pick(?:ing)?|beach cleaning)\b|[捡撿]垃圾|海[滩灘]清[洁潔理]/gi],
  ['climbing', /\b(?:climbing|bouldering)\b|攀[岩巖]/gi],
  ['basketball', /\bbasketball\b|打?籃球|打?篮球/gi],
  ['badminton', /\bbadminton\b|羽毛球/gi], ['football', /\b(?:football|soccer)\b|踢球|足球/gi],
  ['volleyball', /\bvolleyball\b|排球/gi], ['tennis', /\btennis\b|网球|網球/gi],
  ['table-tennis', /\b(?:table tennis|ping[ -]?pong)\b|乒乓球|兵乓球/gi],
  ['piano', /\bpiano\b|鋼琴|钢琴|彈琴|弹琴/gi], ['chess', /\bchess\b|国际象棋|國際象棋|西洋棋/gi],
  ['xiangqi', /象棋|中國棋|中国棋/gi], ['go', /\b(?:baduk|weiqi|game of go)\b|围棋|圍棋/gi],
  ['coffee', /\b(?:coffee|cafe|café)\b|咖啡/gi], ['hiking', /\b(?:hike|hiking|trail walk|trekking)\b|行山|爬山|远足|遠足|徒步/gi],
  ['running', /\b(?:running|jogging|jog|go for a run)\b|跑步|慢跑/gi], ['gym', /\b(?:gym|workout|work out|weightlifting)\b|健身|举铁|舉鐵/gi],
  ['swimming', /\b(?:swim|swimming)\b|游泳/gi], ['dinner', /\b(?:dinner|supper)\b|晚饭|晚飯|晚餐/gi],
  ['lunch', /\blunch\b|午饭|午飯|午餐/gi], ['board-games', /\bboard games?\b|桌游|桌遊/gi],
  ['minecraft', /\bminecraft\b/gi],
  ['karaoke', /\bkaraoke\b|唱[广廣][东東]歌|唱卡拉ok/gi],
  ['mahjong', /\bmahjong\b|麻雀|麻将|麻將/gi], ['cinema', /\b(?:movie|cinema|film screening)\b|看电影|睇戲|看電影/gi],
];
function parseSocialSection(post: MatchPost): MatchIntent[] {
  const text = fullText(post); const t = normalizeText(text);
  if (isCancelled(text)) return [];
  const invitation = requestsCooperation(text, 'activity') || /\b(?:anyone|anybody|someone|somebody)\b.{0,35}\b(?:up for|want|wanna|for|fancy|join|interested|free for|keen|down for)|\b(?:looking|lookin|find|seeking|want|need)\b.{0,55}\b(?:buddy|partner|buddies|companion|companions|company|people|someone|group|opponent|peers)|\b(?:buddy|partner|companion|opponent|peers)(?:\s+wanted|\b)|\b(?:let'?s|join me|join us|come along|wanna|who'?s up for|go together)|想[约約]同[学學]|想找人|有[没冇]有人?想一[齐齊起]|有[没冇]人.{0,35}(?:一[齐齊起]|打|行山|游泳|咖啡)|[约約]人|揾人|搵人|搵[个個]|揾[个個]|(?:搵|找).{0,12}(?:同伴|搭子|伙伴|夥伴)|另找人|一[齐齊起].{0,15}(?:吗|嗎|嘛|呀|啊|[？?])/.test(t);
  if (/\b(?:not my event|not joining|just a diary|not want company|not looking for companions)\b|不是[约約]人|没有[约約]活[动動]|只是(?:感[叹嘆]|引用)|不[约約]人/.test(t)) return [];
  const joining = /\b(?:hoping|looking|want(?:ing)?|keen) to join\b|想加入|希望加入|想[参參]加/.test(t);
  const vacancies = quantity(t, [
    `(?:inviting|invite) ${NUMBER} more (?:(?:female|male) )?(?:students?|people|players?)`,
    `${NUMBER} (?:more (?:student|person|player)s? welcome|(?:open |available )?(?:places?|spots?) (?:left|available))`,
    `(?:搵|找|缺|仲有|还有|還有|還可加|还可加)\\s*${NUMBER}\\s*(?:位|个|個|人)`,
  ]);
  const unlimitedPlaces = /\b(?:unlimited places|no participant limit|no limit on (?:participants|attendance))\b|人[数數]不限|不限人[数數]/.test(t) &&
    !/\b(?:not unlimited|places are limited|limited places|participant limit applies)\b|不是不限|並非不限|并非不限|名[额額]有限/.test(t) && vacancies === undefined;
  const limitedPlaces = vacancies !== undefined || /\b(?:not unlimited|places are limited|limited places|participant limit applies|limited attendance)\b|名[额額]有限|人[数數]有限/.test(t);
  const hosting = unlimitedPlaces || vacancies !== undefined || /\binviting (?:classmates|students|people)\b|邀[请請]同[学學]加入/.test(t) || /\b(?:i am|i'm|we are|we're) (?:hosting|organising|organizing)\b/.test(t);
  if (!invitation && !joining && !hosting) return [];
  if (/\b(?:do not|don't|not) (?:want|plan|intend) to join\b|不想加入|不加入|不想[参參]加|不[参參]加/.test(t)) return [];
  if (/\b(?:might|may|not sure|undecided)\b.{0,25}\bjoin\b|不知.{0,10}(?:加入|需要)|未决定|未決定/.test(t)) return [];
  const side: MatchIntent['side'] = joining && !hosting ? 'seek' : hosting && !joining ? 'offer' : 'peer';
  const party = joining ? quantity(t, [`${NUMBER} (?:students?|persons?) (?:looking|hoping)`, `(?:i am|i'm|we are) ${NUMBER.replace('|a|an|','|')}(?:\\s|$)`, `我${NUMBER}(?:个|個)人`, `我\\s*${NUMBER}\\s*位(?:同[学學])?`, `(?:男|女)同[学學]${NUMBER}[个個]`]) ?? (/\b(?:just me|only me|on my own)\b/.test(t) && !/\b(?:not|isn'?t|is not)\s+(?:just me|only me|on my own)\b|\b(?:just me|only me)\s+(?:and|plus)\b/.test(t) ? 1 : undefined) : undefined;
  const timing = schedule(post);
  const allPlaceMentions = places(text);
  const bodyPlaceMentions = allPlaceMentions.filter(p => p.start >= post.title.length + 1);
  const placeMentions = bodyPlaceMentions.length ? bodyPlaceMentions : allPlaceMentions;
  const explicitPlace = placeMentions.find(p => /\b(?:near|at|in|around|meet(?:ing)?(?: at)?|start(?:ing)?(?: at)?|on)\s*$/i.test(text.slice(Math.max(0, p.start - 30), p.start)) || /(?:见|見|集合|碰面|出[发發])/.test(text.slice(p.end, p.end + 18)) || /(?:在|去|约|約|喺)\s*$/.test(text.slice(Math.max(0, p.start - 10), p.start)));
  let place = (explicitPlace ?? (placeMentions.length === 1 ? placeMentions[0] : undefined))?.id;
  const commonRooms = [...t.matchAll(/\b((?:ug|pg) hall [a-z0-9]+)\s+common room\b/g)]
    .map(match=>canonicalHallName(match[1])).filter((value): value is string=>Boolean(value));
  if (new Set(commonRooms).size === 1) place = `${commonRooms[0]}:common-room`;
  const guestAccess: MatchIntent['guestAccess'] = /\b(?:residents only|no guests|cannot admit guests)\b|只限本堂|不可帶|不可带/.test(t) ? 'restricted'
    : /(?:帶|带).{0,15}(?:非本堂|非本宿舍).{0,15}(?:入場|入场)|\b(?:can|will) admit guests\b|\bopen to non-residents\b/.test(t) ? 'provided' : undefined;
  const courts = unique([...t.matchAll(/\bcourt\s*(\d+)\b|(\d+)[号號](?:篮球|籃球|羽毛球|网球|網球)?[场場]/g)]
    .map(match => String(Number(match[1] || match[2]))));
  const outdoorBasketball = /\boutdoor basketball court\b|室外\d*[号號]?(?:篮球|籃球)[场場]/.test(t);
  const indoorBasketball = /\bindoor basketball court\b|室[内內]\d*[号號]?(?:篮球|籃球)[场場]/.test(t);
  if (outdoorBasketball !== indoorBasketball) {
    if (!bodyPlaceMentions.length) place = undefined;
    place = `${place ? `${place}:` : ''}${outdoorBasketball ? 'outdoor' : 'indoor'}-basketball`;
  }
  const venueMissing = new Set(commonRooms).size > 1 || courts.length > 1 || (outdoorBasketball && indoorBasketball) ? ['activity-venue'] : [];
  if (place && courts.length === 1) place += `:court-${courts[0]}`;
  const tables = unique([...t.matchAll(/\btable\s*(\d+)\b|(\d+)[号號][枱台桌]/g)].map(m=>String(Number(m[1] || m[2]))));
  if (tables.length > 1) venueMissing.push('activity-venue');
  if (place && tables.length === 1) place += `:table-${tables[0]}`;
  // Named online meeting rooms are specific venues, not generic 'online' compatibility.
  const discordRooms = unique([
    ...[...t.matchAll(/在\s*([a-z0-9][a-z0-9 ]{0,50}?) discord\b/g)].map(m => m[1].trim()),
    ...[...t.matchAll(/\bin ([a-z0-9][a-z0-9 ]{0,50}?) discord(?:,|\.|$)/g)].map(m => m[1].trim()),
    ...[...t.matchAll(/\bat ([a-z0-9][a-z0-9 ]{0,50}?) discord\b/g)].map(m => m[1].trim()),
  ]);
  const discordChannels = unique([...t.matchAll(/\b(?:the )?([a-z0-9-]+) voice channel\b|的\s*([a-z0-9-]+)\s*語音頻道/g)].map(m => m[1] || m[2]));
  if (discordRooms.length === 1 && discordChannels.length === 1)
    place = `discord:${discordRooms[0]}:voice:${discordChannels[0]}`;
  if (discordRooms.length > 1 || discordChannels.length > 1) venueMissing.push('activity-venue');
  const language = communication(text);
  // Only explicit self descriptions are evidence; never infer identity from names or profiles.
  const alcoholFree = /\b(?:alcohol-free|no alcohol|without alcohol)\b|全[场場][无無]酒精|不[飲饮]酒/.test(t) &&
    !/\b(?:not alcohol-free|not without alcohol)\b|不是[无無]酒精/.test(t);
  const requiresAlcoholFree = /\b(?:only (?:join|attend) alcohol-free|(?:join|attend) (?:an? )?alcohol-free|(?:karaoke|event|dinner) without alcohol)\b|只參加無酒精|只参加无酒精/.test(t) &&
    !/\b(?:not|never|won't|will not) (?:only )?(?:join|attend)\b|不參加|不参加/.test(t);
  const alcoholAllowed = /\balcohol (?:is )?allowed\b|允許飲酒|允许饮酒/.test(t) &&
    !/\b(?:no alcohol allowed|alcohol is not allowed)\b|不允許飲酒|不允许饮酒/.test(t);
  const acceptsAlcoholFree = /\b(?:refuse|won't accept|will not accept) (?:an? )?alcohol-free\b|不接受[无無]酒精/.test(t) ? false
    : /\bi agree to no alcohol\b|我接受[无無]酒精|我不[飲饮]酒/.test(t) ? true : undefined;
  const vegetarianOnly = /\bvegetarian (?:food |meals? )?only\b|只[點点]素食|只吃素食/.test(t);
  const refusesVegetarian = /\b(?:won't|will not|cannot|can't|refuse to) (?:eat|join) (?:a )?vegetarian\b|不接受素食|不吃素食/.test(t);
  const acceptsVegetarian = refusesVegetarian ? false : /\b(?:i am (?:a )?vegetarian|join a vegetarian (?:dinner|lunch|meal)|happy to eat vegetarian)\b|我吃素|我係素食者|我接受素食/.test(t) ? true : undefined;
  const participantLevel = /\bi(?:'m| am) (?:a |an )?(?:postgraduate|pg)\b|我(?:是|係)(?:研究生|碩士生|硕士生|博士生)/.test(t) ? 'pg' as const
    : /\bi(?:'m| am) (?:a |an )?(?:undergraduate|ug)\b|我(?:是|係)本科生/.test(t) ? 'ug' as const : undefined;
  const requiredParticipantLevel = /\b(?:pg|postgraduates?)(?: students?)? only\b|(?:只)?限\s*(?:pg|研究生)/.test(t) ? 'pg' as const
    : /\b(?:ug|undergraduates?)(?: students?)? only\b|(?:只)?限\s*(?:ug|本科生)/.test(t) ? 'ug' as const : undefined;
  const participantGender = /\bi(?:'m| am) (?:a |one )?female\b|(?:我(?:是|係)?|^|[。,.，])女同[学學]/.test(normalizeText(post.body)) ? 'female'
    : /\bi(?:'m| am) (?:a |one )?male\b|(?:我(?:是|係)?|^|[。,.，])男同[学學]/.test(normalizeText(post.body)) ? 'male' : undefined;
  const requiredParticipantGender = /\bfemale(?: students?)? only\b|\binviting (?:one|two|three|\d+) more female students?\b|只限女同[学學]/.test(t) ? 'female'
    : /\bmale(?: students?)? only\b|\binviting (?:one|two|three|\d+) more male students?\b|只限男同[学學]/.test(t) ? 'male' : undefined;
  let equipment = /\b(?:my|our|their) own rackets?\b|我有球拍|自備球拍/.test(t) && !/請自備|请自备|please|\b(?:without|not|no) (?:my |our |their )?own racket|沒有球拍|没有球拍/.test(t) ? ['racket'] : undefined;
  const borrowedEquipment = /\b(?:need(?:s)? to borrow|need(?:s)? (?:a )?loan(?:er)?|borrow) (?:a |your )?rackets?\b|需要借球拍|想借球拍/.test(t) ? ['racket'] : undefined;
  const providedEquipment = /\brackets? (?:are )?provided\b|\b(?:can lend|will lend|can provide) (?:you |a |spare )*rackets?\b|可(?:以)?借出球拍|提供球拍/.test(t) &&
    !/\b(?:no rackets?|rackets? (?:are )?not provided|cannot (?:lend|provide)|can't (?:lend|provide))\b|不提供球拍|不借出球拍/.test(t) ? ['racket'] : undefined;
  let requiredEquipment = /\b(?:bring|must have|need your) (?:your |a |own )*rackets?\b|請自備球拍|请自备球拍/.test(t) ? ['racket'] : undefined;
  const photoActivity = /\b(?:photo[ -]?walk|photography walk)\b|攝影散步|摄影散步|拍照散步|散步拍照/.test(t);
  if (photoActivity) {
    if (/\b(?:i have|i own|bringing|with my) (?:a |my |own )?(?:dslr|mirrorless camera)\b|我有(?:單反|单反|相機|相机)/.test(t) &&
        !/\b(?:no|not|without) (?:a |my )?(?:dslr|mirrorless camera)\b|沒有(?:單反|单反|相機|相机)|没有(?:單反|单反|相機|相机)/.test(t)) equipment = [...(equipment ?? []),'camera'];
    if (/\b(?:camera required|must bring (?:a |your )?camera|bring your own camera)\b|必須帶相機|必须带相机|請自備相機|请自备相机/.test(t) &&
        !/\b(?:no camera required|camera not required)\b|不必須帶相機|不必须带相机/.test(t)) requiredEquipment = [...(requiredEquipment ?? []),'camera'];
  }
  const requiredWalkingMinutes = /\b(?:must|need to|please ensure you can) walk\s+(\d{1,3})\s*minutes\b|(?:必須|必须|請確定自己可以|请确定自己可以)(?:連續|连续)?行(\d{1,3})分[鐘钟]/.exec(t);
  const walkingMatch = /\bi can (?:comfortably )?walk\s+(\d{1,3})\s*minutes\b|我可以(?:連續|连续)?行(\d{1,3})分[鐘钟]/.exec(t);
  let walkingMinutes = walkingMatch ? Number(walkingMatch[1] || walkingMatch[2]) : undefined;
  if (walkingMinutes === undefined && /\bi can (?:comfortably )?walk that long\b/.test(t)) {
    const durations = [...t.matchAll(/\b(\d{1,3})[ -]minutes?\b/g)].map(m=>m[1]);
    if (new Set(durations).size === 1 && /\b\d{1,3}[ -]minute\b.{0,45}\bwalk\b/.test(t)) {
      walkingMinutes = Number(durations[0]);
    }
  }
  const skill = /\b(?:i(?:'m| am)(?: a)? beginner|i am (?:one|a) (?:badminton|tennis|basketball) beginner|beginner looking|i(?:'m| am) new|complete beginner)\b|乒乓球初[學学]|我(?:係|是)?(?:完全)?初[级級学學]|我(?:係|是)?新手/.test(t) ? 'beginner' : /\b(?:i(?:'m| am)(?: an)? advanced|experienced climber)\b|我(?:是|係)?高手/.test(t) ? 'advanced' : undefined;
  const requiredSkill = /\bbeginners? only\b|\binviting (?:one|two|three|\d+) more (?:(?:female|male) )?student beginners?\b|只限新手|只限初[学學]者/.test(t) ? 'beginner' : /\b(?:advanced only|advanced .{0,20}partner|no beginners|must already know)\b|只(?:找|要)高手|不要新手|不收新手/.test(t) ? 'advanced' : undefined;
  const matches = ACTIVITIES.flatMap(([entity, re]) => [...text.matchAll(re)].map(m => ({ entity, start: m.index!, end: m.index! + m[0].length, text: m[0] })))
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((a, i, all) => !all.slice(0, i).some(b => b.start <= a.start && b.end >= a.end));
  return unique(matches.filter(activity => {
    const before = normalizeText(text.slice(Math.max(0, activity.start - 40), activity.start));
    return !/(?:\b(?:not(?: available for| interested in)?|no|never|hate|dislike)\s*(?:playing\s+|doing\s+)?|不(?:想|去|打)|唔(?:想|去|打))\s*$/.test(before);
  }).map(a => a.entity)).filter((entity, _index, all) => (entity !== 'board-games' || !all.some(name => name.startsWith('board-game:'))) && (entity !== 'walking' || !all.includes('photo-walk'))).map(entity => entity === 'minecraft' ? (
    /\bminecraft java\b/.test(t) && /\bsurvival\b/.test(t) &&
    !/\b(?:not|no|never) (?:playing |play )?(?:minecraft java|survival)\b/.test(t)
      ? 'minecraft:java:survival' : 'minecraft:unspecified'
  ) : entity).map(entity => ({
    kind: 'other', entity, side, seats: vacancies, unlimitedPlaces, limitedPlaces, party, guestAccess, communication: language, alcoholFree, requiresAlcoholFree, alcoholAllowed, acceptsAlcoholFree, vegetarianOnly, acceptsVegetarian, participantLevel, requiredParticipantLevel, participantGender, requiredParticipantGender, equipment, requiredEquipment, providedEquipment, borrowedEquipment, place, skill, requiredSkill, walkingMinutes, requiredWalkingMinutes: requiredWalkingMinutes ? Number(requiredWalkingMinutes[1] || requiredWalkingMinutes[2]) : undefined, date: timing.date, minute: timing.minute,
    endMinute: timing.endMinute, strictTime: timing.strictTime, evidence: evidence(text), missing: unique([...timing.missing, ...venueMissing, ...(entity === 'minecraft:unspecified' ? ['topic' as const] : []), ...(place ? [] : ['place'])]),
  }));
}

/** Explicit separate requests retain their own cancellation and schedule scope. */
function intentSections(post: MatchPost): MatchPost[] {
  const body = post.body.split(/(?<=[.!。])\s*(?=still (?:need|want|looking|inviting|hosting|organising|organizing|offering)\b)|[;；]\s*(?=(?:周|星期|\d{1,2}[日号號]|\d{1,2}月|\d{1,2}(?:sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug)))|\n\s*\n|\n(?=\s*(?:also\b|separately\b|i (?:need|can|want)|looking\b|selling\b|另外|我(?:想|要|可以)))|\s*\b(?:but|however|separately)\b(?!\s+(?:only|must|not|online|at|in person|places are limited|attendance is limited|(?:i|we) (?:must|can meet|cannot meet|can't meet))\b)[,;:]?\s*|(?:但是|不过|不過|但係)(?!\s*(?:只|必须|必須|不能|唔可以|[线線]上|在))|另外|[;；]\s*(?=(?:also\b|i (?:need|can|want)|looking\b|selling\b|(?:而)?我(?:想|要|需要|可以(?:教|講|讲)|提供|求|找|搵)))/i)
    .map(value => value.trim()).filter(Boolean);
  if (body.length < 2) return [post];
  return body.map((part, index) => ({ ...post, title: index === 0 ? post.title : '', body: part }));
}
function parseSections(post: MatchPost, parse: (section: MatchPost) => MatchIntent[]): MatchIntent[] {
  // A withdrawal in the title describes the whole post, unless the title itself separates intents.
  const mixedTitle = /\b(?:one|another|other)\b.{0,20}\bstill (?:running|open|available)\b/i.test(post.title) &&
    /[.!。]\s*still (?:offering|inviting|need|want|looking)\b/i.test(post.body);
  if (isCancelled(post.title) && !mixedTitle && !/\bbut\b|另外|但是|[;；]/i.test(post.title)) return [];
  const sections = intentSections(post);
  if (parse === parseStudySection && sections.length === 2 &&
      !/\b(?:but|however|separately|also|still)\b|另外|但是|不過|不过/.test(post.body)) {
    const [first, second] = sections;
    const courses = studyEntities(fullText(first));
    const firstRole = studySide(first.body) ?? studySide(fullText(first));
    const secondRole = studySide(second.body);
    const firstTime = schedule(first), secondTime = schedule(second);
    // Keep a sole course's trailing details; never merge two dated sessions.
    if (!isCancelled(fullText(first)) && !isCancelled(second.body) &&
        new Set(courses.map(c=>c.entity)).size === 1 && !studyEntities(second.body).length &&
        firstRole && (!secondRole || secondRole === firstRole) &&
        !transportSide(second.body) && !parseSocialSection(second).length &&
        !/\b(?:sell|selling|buy|buying|borrow|lend)\b|出售|求购|求購|借用/.test(second.body) &&
        firstTime.date === undefined && firstTime.minute === undefined &&
        secondTime.date !== undefined && secondTime.minute !== undefined) return parse(post);
  }
  return sections.flatMap(section => parse(section));
}
export function parseTransport(post: MatchPost): MatchIntent[] { return parseSections(post, parseTransportSection); }
export function parseStudy(post: MatchPost): MatchIntent[] { return parseSections(post, parseStudySection); }
export function parseSocial(post: MatchPost): MatchIntent[] { return parseSections(post, parseSocialSection); }
