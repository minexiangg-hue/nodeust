import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='Inviting classmates for a photography walk on 26 Sep 2026, 17:00–18:00. Meet at campus sundial, English chat.';
const b='我一個人想參加9月26日17:00–18:00的攝影散步，在日晷集合，英文交流。';
test('photography invitations retain their host and guest roles and specific activity',()=>{
 const x=parseMatchPost(p(a,'a')),y=parseMatchPost(p(b,'b'));
 assert.ok(x.intents.some(i=>i.entity==='photo-walk'&&i.side==='offer'));
 assert.ok(y.intents.some(i=>i.entity==='photo-walk'&&i.side==='seek'));
 assert.equal(x.intents.some(i=>i.entity==='walking'),false);
 assert.equal(y.intents.some(i=>i.entity==='walking'),false);
 const result=comparePosts(x,y,now);
 assert.equal(result?.confidence,'high');
 assert.equal(x.intents[0].unlimitedPlaces,false);
});
test('negative participation does not become a photography join request',()=>{
 assert.equal(parseMatchPost(p(b.replace('想參加','不想參加'),'b')).intents.some(i=>i.kind==='other'),false);
});


test('open invitations do not imply unlimited places; explicit attendance limits still apply',()=>{
 const pair=body=>comparePosts(parseMatchPost(p(body,'a')),parseMatchPost(p(b,'b')),now);
 for(const text of ['Unlimited places.','No limit on participants.','人數不限。'])assert.equal(pair(a+text)?.confidence,'high');
 assert.equal(pair(a+'Everyone welcome.')?.confidence,'high');
 for(const text of ['Not unlimited places.','Unlimited places, but places are limited.'])assert.notEqual(pair(a+text)?.confidence,'high');
 const limited=a+' Unlimited places. One more student welcome.';
 const result=comparePosts(parseMatchPost(p(limited,'a')),parseMatchPost(p(b.replace('我一個人','我兩個人'),'b')),now);
 assert.equal(result,null);
});


test('photography equipment requirements need explicit participant equipment',()=>{
 const host=a+' Unlimited places. Camera required.';
 const compare=guest=>comparePosts(parseMatchPost(p(host,'a')),parseMatchPost(p(guest,'b')),now);
 assert.notEqual(compare(b+'只用手機。')?.confidence,'high');
 assert.equal(compare(b+'我有相機。')?.confidence,'high');
 assert.notEqual(compare(b+'我沒有相機。')?.confidence,'high');
 assert.equal(compare(b+' I own a mirrorless camera.')?.confidence,'high');
 assert.notEqual(compare(b+' I have no mirrorless camera.')?.confidence,'high');
});
