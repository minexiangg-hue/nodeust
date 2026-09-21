import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost} from '../../lib/match/engine.ts';
import {parseCurrentMatchPost} from '../../lib/match/parsed-post-cache.ts';
const post={id:'housing',ownerId:'alice',title:'Room exchange',body:'Swap Hall I to Hall II for fall 2026, unrestricted.',category:'hall',currentHall:'Hall I',targetHall:'Hall II',roomType:'single',genderEligibility:'any',createdAt:'2026-09-20T00:00:00.000Z',updatedAt:'2026-09-20T00:00:00.000Z'};
test('same-timestamp room and eligibility edits cannot reuse the old housing interpretation',()=>{
 const cached=parseMatchPost(post);
 assert.equal(cached.intents[0].room,'single');
 const changed=parseCurrentMatchPost({...post,roomType:'double',genderEligibility:'female'},cached);
 assert.equal(changed.intents[0].room,'double');
 assert.equal(changed.intents[0].eligibility,'female');
 assert.equal(cached.intents[0].room,'single');
});
test('unchanged semantic inputs reuse parsing while exposing fresh display metadata',()=>{
 const cached=parseMatchPost(post);
 const current={...post,createdAt:new Date(post.createdAt),updatedAt:new Date(post.updatedAt),replyCount:7};
 const result=parseCurrentMatchPost(current,cached);
 assert.equal(result.intents,cached.intents);
 assert.equal(result.post,current);
 assert.equal(result.post.replyCount,7);
});
test('inactive post and invalid version timestamps never inherit an active cached parse',()=>{
 const cached=parseMatchPost(post);
 assert.deepEqual(parseCurrentMatchPost({...post,status:'closed'},cached).intents,[]);
 const malformed={...post,updatedAt:'invalid date'};
 const invalidCache=parseMatchPost(malformed);
 assert.notEqual(parseCurrentMatchPost(malformed,invalidCache).intents,invalidCache.intents);
});
