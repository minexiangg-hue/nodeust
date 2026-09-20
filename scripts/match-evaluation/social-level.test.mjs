import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='Inviting classmates for dinner at LG7 on 26 Sep 2026, 18:00–19:00. Unlimited places, English chat. Postgraduates only.';
const b='I am one person hoping to join dinner at LG7 on 26 Sep 2026, 18:00–19:00. English chat.';
const pair=body=>comparePosts(parseMatchPost(p(a,'a')),parseMatchPost(p(body,'b')),now);
test('study-level eligibility needs an explicit participant claim',()=>{
 assert.equal(pair(b+' I am a postgraduate.')?.confidence,'high');
 assert.equal(pair(b+' 我是研究生。')?.confidence,'high');
 assert.equal(pair(b+' I am an undergraduate.'),null);
 assert.notEqual(pair(b)?.confidence,'high');
 assert.notEqual(pair(b+' I am not a postgraduate.')?.confidence,'high');
 assert.notEqual(pair(b+' My friend is a postgraduate.')?.confidence,'high');
});

test('a self-description article is not an explicit participant count',()=>{
 const unspecified=b.replace('I am one person','I am a postgraduate');
 assert.equal(pair(unspecified)?.confidence,'high');
 const limited=parseMatchPost(p(a.replace('Unlimited places','One more student welcome'),'a'));
 assert.notEqual(comparePosts(limited,parseMatchPost(p(unspecified,'b')),now)?.confidence,'high');
 const parsed=parseMatchPost(p(unspecified,'b')).intents.find(i=>i.kind==='other');
 assert.equal(parsed?.party,undefined);
 assert.equal(pair(b+' I am a postgraduate.')?.confidence,'high');
});
