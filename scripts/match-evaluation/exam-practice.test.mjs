import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'study',createdAt:now.toISOString()});
const a='Seeking an IELTS speaking practice partner. English, Zoom, 26 Sep 2026 from 14:00 to 15:00.';
const b='我考雅思，想同另一位考生互相練口語，不要付費老師。9月26日14:00–15:00可 Zoom，用英文練。';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('named exams can identify study requests without university course codes',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('雅思','托福')),null);
 assert.equal(pair(a,b.replace('口語','寫作')),null);
 assert.notEqual(pair(a,b.replace('口語','考試內容'))?.confidence,'high');
 assert.notEqual(pair(a,b.replace('互相練口語','不互相練口語'))?.confidence,'high');
});
