import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id,title='')=>({id,ownerId:id,title,body,category:'transport',createdAt:now.toISOString()});
const a='My 25 Sep airport drive is cancelled. Still offering a free lift on 26 Sep 2026 at 10:00 from HKUST to Kowloon Station: one passenger seat free, one backpack allowed.';
const b='One person needs a free lift from HKUST to Kowloon Station on 26 Sep 2026 at 10:00. One backpack.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('cancelled old travel does not remove an explicitly continuing separate lift',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('One backpack','Two backpacks')),null);
 assert.equal(pair(a,b.replace('26 Sep','25 Sep')),null);
 assert.equal(parseMatchPost(p(a,'a','Cancelled')).intents.length,0);
});
test('a free passenger seat is not necessarily a free fare',()=>{
 const result=pair(a.replace('a free lift','a lift'),b);
 assert.notEqual(result?.confidence,'high');
});


test('mixed-status titles preserve only explicitly continuing body sections',()=>{
 const host=parseMatchPost(p(a,'a','One trip cancelled, one still running'));
 assert.equal(comparePosts(host,parseMatchPost(p(b,'b')),now)?.confidence,'high');
 assert.ok(host.intents.every(i=>i.date!=='2026-09-25'));
 assert.equal(parseMatchPost(p(a,'a','All trips cancelled')).intents.length,0);
 assert.equal(parseMatchPost(p(a.replace('Still offering','Was offering'),'a','One trip cancelled, one still running')).intents.length,0);
});
