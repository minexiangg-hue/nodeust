import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'goods',createdAt:now.toISOString()});
const a='Looking to buy Example Mathematics: Advanced Methods, 4th edition, English print copy. Budget HKD180.';
const b='Selling Example Mathematics: Advanced Methods 第4版，英文紙本，HKD150。';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('literal textbook title, edition, format and language all participate in compatibility',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 for(const [before,after] of [['Advanced Methods','Basic Methods'],['第4版','第3版'],['英文','中文'],['紙本','電子版']])assert.equal(pair(a,b.replace(before,after)),null);
 assert.notEqual(pair(a,b.replace('英文紙本',''))?.confidence,'high');
});

test('negated book format or language cannot be promoted to an accepted positive value',()=>{
 assert.notEqual(pair(a,b.replace('英文紙本','not English print'))?.confidence,'high');
});
