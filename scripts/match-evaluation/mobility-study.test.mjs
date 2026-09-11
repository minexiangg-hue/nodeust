// Parser regression cases. Includes development failures; never acceptance evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import { compareIntents } from '../../lib/match/engine.ts';
import { parseTransport, parseStudy, parseSocial } from '../../lib/match/mobility-study.ts';
const post = (body, extra = {}) => ({ id: 'parser-regression', category: 'other', title: '', body, locationId: 'ug-hall-i', createdAt: '2026-09-11T10:00:00Z', ...extra });
const first = (parser, text, extra) => { const result = parser(post(text, extra)); assert.equal(result.length, 1, JSON.stringify(result)); return result[0]; };
test('transport: multilingual explicit route, party and taxi capacity', () => {
  const result = first(parseTransport, '聽日晚上七點，科大去機場，夾的士？我哋兩個，普通四客座的士。');
  assert.deepEqual([result.from, result.to, result.side, result.party, result.capacity, result.date, result.minute, result.missing], ['hkust','airport','share',2,4,'2026-09-12',1140,[]]);
});
test('transport: reversed natural word order retains direction', () => {
  const result = first(parseTransport, 'Need a lift to the airport from campus tomorrow at 7pm for three people.');
  assert.deepEqual([result.from,result.to,result.side,result.party], ['hkust','airport','rider',3]);
});
test('transport: location tag never supplies missing origin', () => {
  const result = first(parseTransport, 'Need a ride to the airport tomorrow at 19:00. Just me.');
  assert.equal(result.from, undefined); assert.ok(result.missing.includes('from')); assert.equal(result.party,1);
});
test('transport: a taxi mention never invents four seats or a solo passenger', () => {
  const result = first(parseTransport, 'Share a taxi from Hang Hau to HKUST tomorrow at 19:00?');
  assert.equal(result.capacity,undefined); assert.equal(result.party,undefined); assert.ok(result.missing.includes('party')); assert.ok(result.missing.includes('capacity'));
});
test('transport: spare seats are driver availability, not total car capacity', () => {
  const result = first(parseTransport, 'I can drive from TKO to Mong Kok on 2026-09-15 at 18:00. Two seats available.');
  assert.deepEqual([result.side,result.seats,result.from,result.to,result.missing], ['driver',2,'tseung-kwan-o','mong-kok',[]]);
});
test('transport: negated driver claim does not override asking for a lift', () => {
  const result = first(parseTransport, "I can't drive. Need a ride from HKUST to Airport tomorrow at 19:00 for 2 people.");
  assert.equal(result.side,'rider'); assert.equal(result.party,2);
});
test('transport: cancelled ride abstains', () => {
  assert.deepEqual(parseTransport(post('Cancelled: need a ride from HKUST to Airport tomorrow at 7pm for 2 people.')), []);
});
test('separate cancelled ride does not cancel active study request', () => {
  const result = first(parseStudy, 'Ride to airport cancelled. But I need a tutor for COMP 4321. English, tomorrow at 19:00.');
  assert.equal(result.entity,'COMP4321'); assert.equal(result.side,'seek'); assert.deepEqual(result.missing, []);
});
test('separate cancelled study does not cancel active ride', () => {
  const result = first(parseTransport, 'Study session cancelled. But need a ride from HKUST to Airport tomorrow at 7pm for 2 people.');
  assert.deepEqual([result.from,result.to,result.side,result.party], ['hkust','airport','rider',2]);
});
test('study: arbitrary course IDs normalize independently of selected category', () => {
  const result = first(parseStudy, 'Can someone explain CHEM-1050 to me? English, tomorrow at 19:00.', {category:'transport'});
  assert.deepEqual([result.entity,result.side,result.communication,result.missing], ['CHEM1050','seek','english',[]]);
});
test('study: tutorial provider and peer are different roles', () => {
  assert.equal(first(parseStudy, 'MATH 2043: I can explain the material. English tomorrow at 7pm.').side,'offer');
  assert.equal(first(parseStudy, 'MATH 2043: looking for a revision buddy. English tomorrow at 7pm.').side,'peer');
});
test('study: language is explicit and never inferred from writing language', () => {
  const result = first(parseStudy, 'Need a tutor for COMP2011 tomorrow at 19:00.');
  assert.equal(result.communication, undefined); assert.ok(result.missing.includes('communication'));
});
test('study: declined language does not become an accepted language', () => {
  const result = first(parseStudy, 'Need a tutor for COMP2011 tomorrow at 19:00. Chinese only, no English.');
  assert.equal(result.communication,'chinese');
});
test('study: textbooks with course codes are not tutoring requests', () => {
  assert.deepEqual(parseStudy(post('Selling COMP 2011 textbook, HKD 120.')), []);
});
test('study: independent courses retain independent offer/seek role and time', () => {
  const results = parseStudy(post('I can explain COMP2011 in English tomorrow at 18:00.\n\nI need a tutor for MATH1013 in Cantonese tomorrow at 20:00.'));
  assert.deepEqual(results.map(i=>[i.entity,i.side,i.communication,i.minute]), [['COMP2011','offer','english',1080],['MATH1013','seek','cantonese',1200]]);
});
test('social: Chinese activity aliases require an invitation', () => {
  const result = first(parseSocial, '聽日晚上七點有冇人想一齊打籃球，校園見？');
  assert.deepEqual([result.entity,result.place,result.minute,result.missing], ['basketball','hkust',1140,[]]);
  assert.deepEqual(parseSocial(post('Basketball is great. Campus tomorrow at 7pm.')), []);
});
test('social: generic location tag does not supply the meeting place', () => {
  const result = first(parseSocial, 'Anyone up for chess tomorrow at 19:00?');
  assert.equal(result.place,undefined); assert.ok(result.missing.includes('place'));
});
test('social: table tennis is distinct from tennis', () => {
  const result = first(parseSocial, 'Anyone up for table tennis near campus tomorrow at 19:00?');
  assert.equal(result.entity,'table-tennis');
});
test('social: chess is distinct from Chinese chess', () => {
  const result = first(parseSocial, '想找人一起国际象棋，campus见，2026-09-15 19:00。');
  assert.equal(result.entity,'chess');
});
test('social: explicit campus sub-location is preserved', () => {
  const result = first(parseSocial, 'Anyone up for coffee at HKUST library tomorrow at 19:00?');
  assert.equal(result.place,'library');
});
test('study: excluded course does not become a requested course', () => {
  const result = first(parseStudy, 'Need a tutor for COMP2011, not MATH1013. English tomorrow at 19:00.');
  assert.equal(result.entity,'COMP2011');
});
test('negated requests do not produce active transport or tutor intents', () => {
  assert.deepEqual(parseTransport(post('I do not need a ride from campus to airport tomorrow at 19:00 for 2 people.')), []);
  assert.deepEqual(parseStudy(post('I do not need a tutor for COMP2011. English tomorrow at 19:00.')), []);
});
test('social: negated activity does not become an invitation', () => {
  const result = first(parseSocial, 'Anyone up for coffee, not basketball, near campus tomorrow at 19:00?');
  assert.equal(result.entity,'coffee');
});
test('explicit body intent takes precedence over a vague or misleading title', () => {
  assert.equal(first(parseStudy, 'COMP2011: looking for a revision buddy. Chinese on 2026-09-15 at 19:00.', {title:'救救'}).side, 'peer');
  assert.equal(first(parseTransport, 'HKUST to Airport on 2026-09-15 at 19:00. Share a taxi? There are two of us; four-passenger taxi.', {title:'ride pls'}).side, 'share');
});
test('ordinary prose next to a calendar year never becomes a course ID', () => {
  const result = first(parseStudy, 'COMP2011: I can explain the material. English on 2026-09-15 at 19:00.');
  assert.equal(result.entity,'COMP2011');
});
test('transport: two separately dated legs do not overwrite outbound availability', () => {
  const result = first(parseTransport, '9月13日10:00科大北门去香港机场，我开车有3个空位；20号才从机场回来，回程暂不接人。');
  assert.deepEqual([result.from,result.to,result.date,result.minute,result.seats,result.missing], ['hkust-north-gate','airport','2026-09-13',600,3,[]]);
});
test('transport: compact digits retain own party distinct from taxi capacity', () => {
  const result = first(parseTransport, 'Hong Kong Airport→HKUST North Gate15Sep21:00. We are2, looking for exactly2others to share a4passenger taxi.');
  assert.deepEqual([result.party,result.capacity,result.side,result.from,result.to], [2,4,'share','airport','hkust-north-gate']);
});
test('transport: Chinese request for passenger seats establishes rider party size', () => {
  const result = first(parseTransport, '9月16日18:30需要1个座位，由科大北门到铜锣湾站。');
  assert.deepEqual([result.side,result.party,result.from,result.to,result.missing], ['rider',1,'hkust-north-gate','causeway-bay',[]]);
});
test('study: negated seeking and an independent teaching offer keep the positive role', () => {
  const result = first(parseStudy, '不是找人教我。COMP2011链表我能讲，英语，9月16日13:00–14:00科大图书馆。', {title:'不是求辅导'});
  assert.equal(result.side,'offer');
});
test('study: separately scoped role on two courses can use a shared explicit schedule', () => {
  const result = parseStudy(post('COMP2011 指针我可以用英语教；MATH1013我自己要找老师。9月15日17:00–18:00都在科大图书馆。'));
  assert.deepEqual(result.map(i=>[i.entity,i.side]), [['COMP2011','offer'],['MATH1013','seek']]);
});
test('study: body course takes precedence over stale title course', () => {
  const result = first(parseStudy, 'Actually need a tutor for COMP2011, in English on 2026-09-15 at 19:00.', {title:'MATH1013 help'});
  assert.equal(result.entity,'COMP2011');
});
test('social: declined activity is not an alternative invitation', () => {
  const result = first(parseSocial, 'Looking for a coffee companion13Sep11:00, meet Hang Hau MTR Exit A. Not available for badminton.');
  assert.equal(result.entity,'coffee'); assert.equal(result.place,'hang-hau');
});
test('social: beginner and required advanced skill remain explicit separate constraints', () => {
  const advanced = first(parseSocial, 'Need an advanced climbing partner15Sep14:00 at HKUST climbing wall; no beginners, must already know belaying.');
  const beginner = first(parseSocial, '9月15日14:00科大攀岩墙找搭子，我完全初学，不会保护操作，需要对方教。');
  assert.equal(advanced.requiredSkill,'advanced'); assert.equal(beginner.skill,'beginner'); assert.equal(advanced.entity,'climbing'); assert.equal(beginner.entity,'climbing');
});
test('social: independent plans retain their own activity, day and place', () => {
  const result = first(parseSocial, '周六9月12日18:00只约羽毛球；周日9月13日11:00另找人喝咖啡，坑口站A出口碰面。两件事分开。');
  assert.deepEqual([result.entity,result.date,result.minute,result.place], ['coffee','2026-09-13',660,'hang-hau']);
});
test('social: non-event quotation and explicit solitary diary abstain', () => {
  assert.deepEqual(parseSocial(post('Saw “chess buddy at library Friday16:00”. Not my event and I am not joining.')), []);
  assert.deepEqual(parseSocial(post('Running alone at HKUST track14Sep19:00. I do NOT want company; this is just a diary entry.')), []);
});
test('explicit departure constraints and windows preserve strict time', () => {
  const driver = first(parseTransport, 'Driving HKUST to Airport on 2026-09-12 at 17:00 sharp. Cannot wait. 2 seats available.');
  const window = first(parseTransport, 'Driving HKUST to Airport on 2026-09-12 at 17:00–17:20, 2 seats available.');
  assert.equal(driver.strictTime,true);assert.equal(window.strictTime,true);assert.equal(window.endMinute,1040);
  const loose = first(parseTransport, 'Driving HKUST to Airport on 2026-09-12 at 17:00, 2 seats available.');assert.equal(loose.strictTime,false);
});
test('study: explicit meeting venue never comes from the location tag or course institution', () => {
  const venue = first(parseStudy, 'Can explain COMP2011 pointers in English, tomorrow at 19:00 in HKUST library.');
  assert.equal(venue.place,'library');
  const absent = first(parseStudy, 'Need a tutor for HKUST COMP2011, English tomorrow at 19:00.', {locationId:'lg1'});
  assert.equal(absent.place,undefined);
});
test('study: online supply is distinct from physical venue and current whereabouts', () => {
  const online = first(parseStudy, 'Can teach COMP2011 pointers over Zoom in English tomorrow at 19:00. I am currently at HKUST library.');
  assert.equal(online.place,'online');
  const offline = first(parseStudy, 'Can teach COMP2011 pointers in English tomorrow at 19:00 at library. No Zoom.');
  assert.equal(offline.place,'library');
});
test('study: clearly accepted online and physical alternatives remain separate choices', () => {
  const results = parseStudy(post('Can explain COMP2011 pointers in English tomorrow at 19:00, either online or at HKUST library.'));
  assert.deepEqual(results.map(i=>i.place).sort((a,b)=>a.localeCompare(b)),['library','online']);
});
test('study: unknown explicit venue remains unresolved instead of disappearing', () => {
  const result = first(parseStudy, 'Need a tutor for COMP2011 in English tomorrow at 19:00. Meet at lecture theatre J.');
  assert.equal(result.place,undefined);assert.ok(result.missing.includes('place'));
});
test('study: constraint-only contrast clause stays attached to the study request', () => {
  const result = first(parseStudy, 'Need a tutor for COMP2011 in English tomorrow at 19:00, but must meet online.');
  assert.equal(result.place,'online');
});
test('study: Chinese and English topic aliases retain explicit concepts', () => {
  const english = first(parseStudy, 'Can explain COMP2011 recursion and pointers in English tomorrow at 19:00.');
  const chinese = first(parseStudy, '需要 COMP2011 递归和指针辅导，用英语，明天19:00。');
  assert.deepEqual(english.topics,['recursion','pointers']);assert.deepEqual(chinese.topics,['recursion','pointers']);
});
test('study: a shared programming language does not erase distinct specific topics', () => {
  const lists = first(parseStudy, 'Can explain COMP1021 Python lists in English tomorrow at 19:00.');
  const recursion = first(parseStudy, 'Need a tutor for COMP1021 Python recursion in English tomorrow at 19:00.');
  assert.deepEqual(lists.topics,['lists']);assert.deepEqual(recursion.topics,['recursion']);
});
test('study: excluded or already understood topics are not requested topics', () => {
  const result = first(parseStudy, 'Need a tutor for COMP2011 pointers, not recursion. English tomorrow at 19:00.');
  assert.deepEqual(result.topics,['pointers']);
  const already = first(parseStudy, 'Already understand recursion. Need a tutor for COMP2011 pointers, English tomorrow at 19:00.');
  assert.deepEqual(already.topics,['pointers']);
});
test('study: unknown expressly restricted concept is not guessed from a known course', () => {
  const result = first(parseStudy, 'Can teach COMP2011 in English tomorrow at 19:00. I only teach monad transformers.');
  assert.equal(result.topics,undefined);assert.ok(result.missing.includes('topic'));
});
test('study: an offer listing options does not require learning every offered topic', () => {
  const offer = first(parseStudy, 'Can explain COMP2011 pointers and recursion in English tomorrow at 19:00.');
  assert.equal(offer.requiredTopics,undefined);
  const seek = first(parseStudy, 'Need a tutor for COMP2011, must cover both pointers and recursion in English tomorrow at 19:00.');
  assert.deepEqual(seek.requiredTopics,['pointers','recursion']);
});
test('study: one course venue does not get copied onto another independently stated course', () => {
  const results = parseStudy(post('Can explain COMP2011 pointers at library in English; MATH1013 needs a tutor in Mandarin. Tomorrow at 19:00.'));
  assert.equal(results.find(i=>i.entity==='COMP2011').place,'library');
  assert.equal(results.find(i=>i.entity==='MATH1013').place,undefined);
});

test('study compatibility: explicit topic and meeting conflicts cannot be high-confidence matches', () => {
  const offer = first(parseStudy, 'Can explain COMP1021 Python lists in English tomorrow at 19:00 at library.');
  const differentTopic = first(parseStudy, 'Need a tutor for COMP1021 Python recursion in English tomorrow at 19:00 at library.');
  const online = first(parseStudy, 'Need a tutor for COMP1021 Python lists in English tomorrow at 19:00 via Zoom.');
  const now = new Date('2026-09-11T10:00:00Z');
  assert.equal(compareIntents(offer,differentTopic,now),null);
  assert.equal(compareIntents(offer,online,now),null);
});
test('study compatibility: an unspecified teaching topic cannot imply knowledge of the requested topic', () => {
  const offer = first(parseStudy, 'Can explain COMP2011 material in English tomorrow at 19:00.');
  const seek = first(parseStudy, 'Need a tutor for COMP2011 pointers in English tomorrow at 19:00.');
  const result=compareIntents(offer,seek,new Date('2026-09-11T10:00:00Z'));
  assert.equal(result?.confidence,'possible');assert.ok(result.missing.includes('topic'));
});


test('study: month-year dates are never separate course identities', () => {
  for (const month of ['Jan','February','Mar','Apr','May','Jun','July','Aug','Sep','Sept','October','Nov','December']) {
    const rows = parseStudy(post(`Can teach COMP2012 in English for free online, 16 ${month} 2027 at 14:00.`));
    assert.deepEqual([...new Set(rows.map(row => row.entity))], ['COMP2012'], month);
  }
});
test('study: explicit inability with a language verb is not an accepted language', () => {
  for (const phrase of ['cannot follow English','cannot teach in English',"can't understand English",'do not speak English',"don't communicate in English"]) {
    const row = first(parseStudy, `Need a tutor for COMP2012. Cantonese only; I ${phrase}. Tomorrow at 14:00 on Zoom.`);
    assert.equal(row.communication, 'cantonese', phrase);
  }
});
test('study: a negated language does not erase a separately accepted one', () => {
  const row = first(parseStudy, 'Can teach COMP2012 in English or Mandarin, but cannot teach in Cantonese. Tomorrow at 14:00 on Zoom.');
  assert.equal(row.communication, 'english|mandarin');
});
