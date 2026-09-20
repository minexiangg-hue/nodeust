import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='Inviting two more students for Minecraft Java survival on 26 Sep 2026, 20:00–22:00. Meet at Campus Players Discord, the Minecraft voice channel. English.';
const b='I want to join Minecraft Java survival on 26 Sep 2026, 20:00–22:00. The Minecraft voice channel in Campus Players Discord. English, just me.';
const pair=(body)=>comparePosts(p(a,'a'),p(body,'b'),now);
test('specific game edition, mode, server and channel form an online activity',()=>{
 assert.equal(pair(b)?.confidence,'high');
 for(const changed of [b.replace('Java','Bedrock'),b.replace('survival','creative'),b.replace('Campus Players','Other Server'),b.replace('Minecraft voice','General voice')])
  assert.notEqual(pair(changed)?.confidence,'high');
});
test('unspecified game editions and modes are not high-confidence matches',()=>{
 const a='Looking for a Minecraft buddy on 26 Sep 2026 at 20:00. English. Meet at campus sundial.';
 assert.notEqual(comparePosts(p(a,'a'),p(a,'b'),now)?.confidence,'high');
 assert.notEqual(pair(b.replace('Minecraft Java survival','not Minecraft Java survival'))?.confidence,'high');
});
