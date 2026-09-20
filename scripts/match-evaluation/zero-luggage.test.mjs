import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-19T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'transport',createdAt:now.toISOString()});
const host='Driving HKUST to airport on 28 Sep 2026 at 07:00, two seats available, HKD 50 per person. No luggage allowed.';
const guest='Need a ride HKUST to airport on 28 Sep 2026 at 07:00, one person, budget HKD 70 per person. No luggage.';
const pair=body=>comparePosts(p(host,'a'),p(body,'b'),now);
test('explicit zero baggage satisfies a no-baggage driver restriction',()=>{
 assert.equal(pair(guest)?.confidence,'high');
 assert.equal(pair(guest.replace('No luggage.','不帶行李。'))?.confidence,'high');
 assert.equal(pair(guest.replace('No luggage.','One backpack.')),null);
 assert.notEqual(pair(guest.replace('No luggage.',''))?.confidence,'high');
});
test('qualified or uncertain no-luggage claims do not silently become zero',()=>{
 for(const phrase of ['No luggage, only one backpack.','Maybe no luggage.','Not without luggage.','No luggage except a handbag.'])
  assert.notEqual(pair(guest.replace('No luggage.',phrase))?.confidence,'high');
});
