import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MatchIndex, compareIntents, comparePosts, parseMatchPost, rankMatches } from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const intent = overrides=>({kind:'goods',entity:'calculator',side:'offer',price:100,currency:'HKD',evidence:['source'],missing:[],...overrides});
test('two buyers and an over-budget offer are not reciprocal demand',()=>{
 assert.equal(compareIntents(intent({side:'seek'}),intent({side:'seek'}),now),null);
 assert.equal(compareIntents(intent({price:200}),intent({side:'seek',price:150}),now),null);
 assert.equal(compareIntents(intent({price:100}),intent({side:'seek',price:150}),now)?.confidence,'high');
});
test('explicit requested model, quantity and handover constrain the offered item',()=>{
 assert.equal(compareIntents(intent({model:'fx991ex'}),intent({side:'seek',model:'fx991cw'}),now),null);
 assert.equal(compareIntents(intent({quantity:1}),intent({side:'seek',quantity:2}),now),null);
 assert.equal(compareIntents(intent({place:'library'}),intent({side:'seek',place:'north-gate'}),now),null);
 assert.equal(compareIntents(intent({}),intent({side:'seek',model:'fx991cw'}),now)?.confidence,'possible');
});
test('same travel route does not override date, direction, seats or withdrawn status',()=>{
 const trip=intent({kind:'transport',entity:'hkust>airport',from:'hkust',to:'airport',date:'2026-09-12',minute:1080,side:'driver',seats:1});
 const rider={...trip,side:'rider',party:2};
 assert.equal(compareIntents(trip,rider,now),null);
 assert.equal(compareIntents(trip,{...rider,party:1,date:'2026-09-13'},now),null);
 assert.equal(compareIntents(trip,{...rider,party:1,from:'airport',to:'hkust'},now),null);
 assert.equal(compareIntents(trip,{...rider,party:1},now)?.confidence,'high');
 assert.equal(compareIntents(trip,{...rider,party:1},new Date('2026-09-13T04:00:00Z')),null);
});
test('language alternatives intersect but explicit conflicting languages do not',()=>{
 const base=intent({kind:'study',entity:'COMP2011',side:'peer',date:'2026-09-12',minute:1080,communication:'english|cantonese'});
 assert.equal(compareIntents(base,{...base,communication:'english'},now)?.confidence,'high');
 assert.equal(compareIntents(base,{...base,communication:'japanese'},now),null);
 assert.equal(compareIntents(base,{...base,communication:undefined},now)?.confidence,'possible');
});
test('retrieval retains old own posts and old candidates past a hundred newer unrelated posts',()=>{
 const own={id:'own-old',ownerId:'me',category:'other',title:'calculator',body:'Looking to buy a calculator. Budget up to HKD 200.',createdAt:'2026-09-01T00:00:00Z',status:'active'};
 const other={...own,id:'offer-old',ownerId:'them',body:'Selling my calculator. Asking HKD 100.'};
 const unrelated=Array.from({length:150},(_,i)=>({...own,id:`chatter-${i}`,ownerId:`u${i}`,body:'nice weather today',title:'hello',createdAt:'2026-09-11T00:00:00Z'}));
 const index=new MatchIndex([own,other,...unrelated]);const parsed=parseMatchPost(own);
 const ids=index.candidates([parsed]);assert.ok(ids.has('offer-old'));
 const rows=rankMatches([parsed],[...ids].map(id=>index.posts.get(id)),now);
 assert.deepEqual(rows.filter(r=>r.confidence==='high').map(r=>r.post.id),['offer-old']);
 assert.equal(comparePosts(parsed,parseMatchPost({...other,ownerId:'me'}),now),null);
 assert.equal(comparePosts(parsed,parseMatchPost({...other,status:'closed'}),now),null);
});
test('foreign currency and bundle prices are never silently compared with unit HKD budgets',()=>{
 assert.equal(compareIntents(intent({currency:'USD',price:20}),intent({side:'seek',currency:'HKD',price:100}),now)?.confidence,'possible');
 assert.equal(compareIntents(intent({priceBasis:'unit',price:200}),intent({side:'seek',priceBasis:'total',quantity:2,price:300}),now),null);
});
test('explicit departure deadlines do not receive a thirty-minute grace period',()=>{
 const base=intent({kind:'transport',entity:'hkust>airport',from:'hkust',to:'airport',date:'2026-09-12',minute:1080,side:'driver',seats:2,strictTime:true});
 assert.equal(compareIntents(base,{...base,side:'rider',party:1,minute:1100},now),null);
 assert.equal(compareIntents(base,{...base,side:'rider',party:1},new Date('2026-09-12T10:01:00Z')),null);
});


test('unknown currencies and multi-item price bases are never inferred from the campus locale', () => {
  assert.equal(compareIntents(intent({currency:undefined}), intent({side:'seek',price:150}), now)?.confidence, 'possible');
  assert.equal(compareIntents(intent({quantity:2}), intent({side:'seek',quantity:2,price:150}), now)?.confidence, 'possible');
  const post = {id:'unknown-money',category:'goods',title:'Calculator',body:'Selling my calculator. Asking 100.',createdAt:now};
  const parsed = parseMatchPost(post).intents.find(row => row.kind === 'goods');
  assert.equal(parsed.currency, undefined);
});

test('known common quantities permit exact unit-to-total comparison, but bundles are not silently split', () => {
  const offer = intent({quantity:2,priceBasis:'unit',price:100});
  const seek = intent({side:'seek',quantity:2,priceBasis:'total',price:200});
  assert.equal(compareIntents(offer, seek, now)?.confidence, 'high');
  assert.equal(compareIntents(offer, {...seek,price:199}, now), null);
  assert.equal(compareIntents({...offer,priceBasis:'total'}, {...seek,quantity:1}, now)?.confidence, 'possible');
  assert.equal(compareIntents({...offer,price:0,currency:undefined,priceBasis:undefined}, {...seek,currency:undefined,priceBasis:undefined}, now)?.confidence, 'high');
});


test('fees distinguish explicitly free provision, missing prices and priced billing units', () => {
 const tutor=intent({kind:'study',entity:'COMP2011',side:'offer',date:'2026-09-12',minute:1080,communication:'english'});
 const learner={...tutor,side:'seek',fee:{amount:0,scope:'maximum'}};
 assert.equal(compareIntents({...tutor,fee:{amount:0,scope:'asking'}},learner,now)?.confidence,'high');
 assert.equal(compareIntents(tutor,learner,now)?.confidence,'possible');
 assert.equal(compareIntents({...tutor,fee:{amount:100,scope:'asking'}},learner,now),null);
 const paid={...tutor,fee:{amount:100,currency:'HKD',basis:'hour',scope:'asking'}};
 const budget={...learner,fee:{amount:120,currency:'HKD',basis:'hour',scope:'maximum'}};
 assert.equal(compareIntents(paid,budget,now)?.confidence,'high');
 assert.equal(compareIntents(paid,{...budget,fee:{...budget.fee,basis:'session'}},now)?.confidence,'possible');
 assert.equal(compareIntents(paid,{...budget,fee:{...budget.fee,amount:90}},now),null);
});


test('activity hosting and joining respect spare places, equipment, skills and languages', () => {
 const host=intent({kind:'other',entity:'badminton',side:'offer',date:'2026-09-12',minute:1080,place:'court-3',seats:1,requiredSkill:'beginner',requiredEquipment:['badminton-racket'],communication:'english|cantonese'});
 const guest={...host,side:'seek',seats:undefined,party:1,requiredSkill:undefined,skill:'beginner',requiredEquipment:undefined,equipment:['badminton-racket'],communication:'english'};
 assert.equal(compareIntents(host,guest,now)?.confidence,'high');
 assert.equal(compareIntents(host,{...guest,party:2},now),null);
 assert.equal(compareIntents(host,{...guest,skill:'advanced'},now),null);
 assert.equal(compareIntents(host,{...guest,communication:'japanese'},now),null);
 assert.equal(compareIntents(host,{...guest,equipment:undefined},now)?.confidence,'possible');
 assert.equal(compareIntents(host,{...guest,side:'offer'},now),null);
});

test('a stated backpack is a fact; an offered baggage limit must be checked', () => {
 const a=intent({kind:'transport',entity:'hkust>airport',from:'hkust',to:'airport',side:'share',date:'2026-09-12',minute:360,party:1,capacity:4,luggage:1,luggageKind:'backpack'});
 const b={...a};
 assert.equal(compareIntents(a,b,now)?.confidence,'high');
 assert.equal(compareIntents({...a,luggageLimit:0,luggageLimitKind:'any'},b,now),null);
 assert.equal(compareIntents({...a,luggageLimit:0,luggageLimitKind:'suitcase'},b,now)?.confidence,'high');
 assert.equal(compareIntents({...a,luggageLimit:1,luggageLimitKind:'any'},{...b,luggage:undefined},now)?.confidence,'possible');
});
