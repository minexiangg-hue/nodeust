import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id,title='')=>({id,ownerId:id,title,body,category:'other',createdAt:now.toISOString()});
const host='Cancelled the movie night. Still inviting two more students to Catan in English at UG Hall III common room on 26 Sep 2026, 19:00–20:30. I can admit guests from other halls.';
const guest='我1位同學想加入英文 Catan 桌遊，9月26日19:00–20:30可以到 UG Hall III common room。';
test('a withdrawn activity does not cancel a separate explicit continuing invitation',()=>{
 const a=parseMatchPost(p(host,'a')),b=parseMatchPost(p(guest,'b'));
 assert.equal(a.intents.some(i=>i.entity==='cinema'),false);
 assert.equal(a.intents.find(i=>i.entity==='board-game:catan')?.seats,2);
 assert.equal(comparePosts(a,b,now)?.confidence,'high');
 assert.equal(comparePosts(a,parseMatchPost(p(guest.replace('我1位','我3位'),'b')),now),null);
});
test('continuing invitations retain their own cancellation and whole-post withdrawal',()=>{
 assert.equal(parseMatchPost(p(host,'a','Cancelled')).intents.length,0);
 const cancelled=host.replace('Still inviting','No longer inviting');
 assert.equal(parseMatchPost(p(cancelled,'a')).intents.length,0);
 const separate=host.replace('26 Sep 2026','27 Sep 2026');
 assert.equal(comparePosts(parseMatchPost(p(separate,'a')),parseMatchPost(p(guest,'b')),now),null);
});
