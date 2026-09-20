import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-19T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'hall',createdAt:now.toISOString()});
const a='Confirmed UG Hall II single for 2026/27, male allocation, eligible to swap. Hoping to get a double in UG Hall IX for the whole year.';
const b='Confirmed male double room in UG Hall IX for the full 2026/27 academic year. Eligible for exchange. Looking for UG Hall II single.';
test('target room preceding its hall does not become the current room',()=>{
 const first=p(a,'a').intents.find(i=>i.kind==='hall');
 assert.equal(first.room,'single');assert.equal(first.wantedRoom,'double');
 assert.equal(comparePosts(p(a,'a'),p(b,'b'),now)?.confidence,'high');
 assert.equal(comparePosts(p(a.replace('Hoping to get','Need'),'a'),p(b,'b'),now)?.confidence,'high');
});
test('whole-year negation and incompatible room requirements remain unresolved or rejected',()=>{
 assert.notEqual(comparePosts(p(a.replace('for the whole year','not for the whole year'),'a'),p(b,'b'),now)?.confidence,'high');
 assert.equal(comparePosts(p(a,'a'),p(b.replace('UG Hall II single','UG Hall II double'),'b'),now),null);
});


test('a comma can separate an explicit confirmed room from its current hall',()=>{
 const comma=b.replace('room in UG Hall IX','room, UG Hall IX');
 const parsed=p(comma,'b').intents.find(i=>i.kind==='hall');
 assert.equal(parsed.from,'ug-hall-9');assert.equal(parsed.room,'double');
 assert.equal(comparePosts(p(a,'a'),p(comma,'b'),now)?.confidence,'high');
 for(const prefix of ['Not confirmed','Hoping for confirmed','My friend has a confirmed']) {
  const uncertain=p(comma.replace('Confirmed',prefix),'b');
  assert.notEqual(comparePosts(p(a,'a'),uncertain,now)?.confidence,'high');
 }
});
