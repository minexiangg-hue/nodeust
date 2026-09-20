import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const parse=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const host=parse('Inviting one more student for a photography walk on 26 Sep 2026, 17:00–18:00. Meet at campus sundial, English chat.','a');
const guest=phrase=>parse(`I want to join a photography walk on 26 Sep 2026, 17:00–18:00 at campus sundial, English chat. ${phrase}.`,'b');
test('explicit colloquial solo participation fills a one-person vacancy',()=>{
 for(const phrase of ['Just me','Only me','On my own']) {
  const parsed=guest(phrase);
  assert.equal(parsed.intents.find(i=>i.kind==='other')?.party,1);
  assert.equal(comparePosts(host,parsed,now)?.confidence,'high');
 }
});
test('negated solo and added companions do not imply a one-person party',()=>{
 for(const phrase of ['Not just me','It is not only me','Just me and my friend','Only me plus a friend'])
  assert.notEqual(comparePosts(host,guest(phrase),now)?.confidence,'high');
});
