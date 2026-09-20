import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='9月27日19:00–21:00 UG Hall V common room 開 Catan 新手局，仲有1位，英文玩；我會在門口帶非本堂同學入場。';
const b='One student looking to join a beginner Catan game, happy playing in English. UG Hall V common room on 27 Sep 2026 from 19:00 to 21:00.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('named board-game invitations retain hall, capacity, language and visitor access',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('Hall V','Hall IV')),null);
 assert.equal(pair(a,b.replace('One student','Two students')),null);
 assert.equal(pair(a,b.replace('Catan','Carcassonne')),null);
 assert.notEqual(pair(a.replace('我會在門口帶非本堂同學入場','只限本堂'),b)?.confidence,'high');
});

test('the generic board-games label cannot override a named-game conflict',()=>{
 assert.equal(pair(a.replace('Catan','Catan board games'),b.replace('Catan','Carcassonne board games')),null);
});
