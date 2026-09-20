import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const host='Inviting classmates for a walk at campus sundial on 26 Sep 2026 at 08:00. Unlimited places, English. Must walk 75 minutes.';
const guest='I am one person hoping to join a walk at campus sundial on 26 Sep 2026 at 08:00. English. I can comfortably walk 80 minutes.';
const pair=body=>comparePosts(parseMatchPost(p(host,'a')),parseMatchPost(p(body,'b')),now);
test('explicit walking endurance is compared without inferring ability from interest',()=>{
 assert.equal(pair(guest)?.confidence,'high');
 assert.equal(pair(guest.replace('80 minutes','60 minutes')),null);
 assert.notEqual(pair(guest.replace('I can comfortably walk 80 minutes.',''))?.confidence,'high');
 assert.equal(pair(guest.replace('I can comfortably walk 80 minutes.','我可以連續行80分鐘。'))?.confidence,'high');
});


test('that long resolves only against one explicit walking duration in the same post',()=>{
 const reference=guest.replace('a walk','an 80-minute walk').replace('I can comfortably walk 80 minutes.','I can comfortably walk that long.');
 assert.equal(pair(reference)?.confidence,'high');
 assert.notEqual(pair(reference.replace('80-minute','60-minute'))?.confidence,'high');
 assert.notEqual(pair(reference+' I may only have 30 minutes.')?.confidence,'high');
 assert.notEqual(pair(reference.replace('I can comfortably','I cannot'))?.confidence,'high');
});


test('pier meeting points are shared across languages without collapsing to the entire district',()=>{
 const host='9月26日08:00西貢碼頭集合，想約同學沿海旁行75分鐘，英文聊天，人數不限。請確定自己可以連續行75分鐘。';
 const guest='I am one person hoping to join an 80-minute Sai Kung waterfront walk, meeting at Sai Kung pier at 08:00 on 26 Sep 2026. I can comfortably walk that long and speak English.';
 const compare=body=>comparePosts(parseMatchPost(p(host,'a')),parseMatchPost(p(body,'b')),now);
 assert.equal(compare(guest)?.confidence,'high');
 assert.notEqual(compare(guest.replace('Sai Kung pier','Sai Kung'))?.confidence,'high');
 assert.equal(compare(guest.replace('Sai Kung pier','campus sundial')),null);
 assert.notEqual(compare(guest.replace('80-minute','60-minute'))?.confidence,'high');
});
