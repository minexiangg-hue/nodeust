import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MatchIndex, compareIntents, comparePosts, parseMatchPost, rankMatches } from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const intent = overrides=>({kind:'goods',entity:'calculator',side:'offer',price:100,evidence:['source'],missing:[],...overrides});
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
 assert.equal(compareIntents(intent({priceBasis:'unit',price:200}),intent({side:'seek',priceBasis:'total',quantity:2,price:300}),now)?.confidence,'possible');
});
test('explicit departure deadlines do not receive a thirty-minute grace period',()=>{
 const base=intent({kind:'transport',entity:'hkust>airport',from:'hkust',to:'airport',date:'2026-09-12',minute:1080,side:'driver',seats:2,strictTime:true});
 assert.equal(compareIntents(base,{...base,side:'rider',party:1,minute:1100},now),null);
 assert.equal(compareIntents(base,{...base,side:'rider',party:1},new Date('2026-09-12T10:01:00Z')),null);
});
