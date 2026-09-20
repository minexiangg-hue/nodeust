import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'transport',createdAt:now.toISOString()});
const a='tag寫科大方便同學搵，但實際出發係坑口站。9月26日14:00我一個人想夾4人座的士去香港機場。';
const b='I am one passenger seeking someone to split a four-seat taxi from Hang Hau Station to Hong Kong airport, 26 Sep 2026 at 14:00.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('an explicit actual origin survives a sentence boundary without using the campus tag',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 const intents=parseMatchPost(p(a,'a')).intents;
 assert.ok(intents.every(i=>i.from!=='hkust'));
 assert.equal(pair(a,b.replace('Hang Hau Station','HKUST')),null);
});
test('incidental places and negative destinations are not cross-sentence routes',()=>{
 for(const body of [a.replace('實際出發係','我而家喺'),a.replace('的士去','的士不去'),a.replace('。9月','。另外一件事。9月')]) {
  assert.notEqual(pair(body,b)?.confidence,'high');
 }
});


test('station exits are directional, bilingual constraints rather than discarded text',()=>{
 const origin=a.replace('坑口站','坑口站B2出口');
 const same=b.replace('Hang Hau Station','Hang Hau Station Exit B2');
 assert.equal(pair(origin,same)?.confidence,'high');
 assert.equal(pair(origin,same.replace('B2','B1')),null);
 assert.notEqual(pair(origin,b)?.confidence,'high');
 assert.equal(pair(a,b)?.confidence,'high');
 const arrivalA=a.replace('香港機場','九龍站D出口');
 const arrivalB=b.replace('Hong Kong airport','Kowloon Station Exit D');
 assert.equal(pair(arrivalA,arrivalB)?.confidence,'high');
 assert.equal(pair(arrivalA,arrivalB.replace('Exit D','Exit A')),null);
});
