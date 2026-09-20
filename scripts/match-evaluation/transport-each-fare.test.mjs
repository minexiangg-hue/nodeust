import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-19T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'transport',createdAt:now.toISOString()});
const driver='Driving HKUST to Mong Kok on 29 Sep 2026 at 18:00, three seats available, HKD 30 per person.';
const rider='Need a lift HKUST to Mong Kok on 29 Sep 2026 at 18:00. We are two people, max HKD 40 each.';
const pair=text=>comparePosts(p(driver,'a'),p(text,'b'),now);
test('each attached to a single fare denotes a per-person budget',()=>{
 assert.equal(pair(rider)?.confidence,'high');
 assert.equal(pair(rider.replace('HKD 40','HK$40'))?.confidence,'high');
 assert.equal(pair(rider.replace('HKD 40','HKD 20')),null);
});
test('each elsewhere or qualified as a baggage charge does not supply fare basis',()=>{
 for(const text of [rider.replace('each.','total.'),rider.replace('each.','. One backpack each.'),rider.replace('each.','each bag.'),rider.replace('each.','each, total.')])
  assert.notEqual(pair(text)?.confidence,'high');
});
