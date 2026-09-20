import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='9月26日18:30校園飯堂正門集合一齊食晚飯，限PG同學，這桌只點素食。還可加2人。';
const b='I am a postgraduate, one person hoping to join a vegetarian dinner. Campus canteen main entrance on 26 Sep 2026 at 18:30.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('vegetarian dinner combines declared food, level, capacity and meeting place',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('postgraduate','undergraduate')),null);
 assert.equal(pair(a,b.replace('one person','three persons')),null);
 assert.equal(pair(a,b.replace('Campus canteen main entrance','campus sundial')),null);
 assert.notEqual(pair(a,b.replace('vegetarian dinner','dinner'))?.confidence,'high');
 assert.equal(pair(a,b+' I will not eat vegetarian.'),null);
});
