import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
import {extractSchedule} from '../../lib/match/text.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='9月26日14:00–15:00想約同學在校園咖啡店正門碰面，買杯咖啡用普通話聊日常。';
const b='Looking for a casual Mandarin conversation companion over coffee. Campus café main entrance, 26 Sep 2026 at 14:00, free until 15:00.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('explicit free-until intervals and cafe entrances align across languages',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('Campus café main entrance','campus sundial')),null);
 assert.equal(pair(a,b.replace('Mandarin','Japanese')),null);
});
test('free-until parsing preserves invalid and conflicting times',()=>{
 const parsed=extractSchedule(p(b,'a'));assert.equal(parsed.minute,840);assert.equal(parsed.endMinute,900);
 for(const body of [b.replace('15:00','13:00'),b.replace('15:00','25:00'),b+' Also at 18:00.']){
  assert.equal(extractSchedule(p(body,'a')).ambiguous,true);
 }
});

test('peer activities need positive shared time, not merely touching endpoints',()=>{
 const later=b.replace('at 14:00, free until 15:00','at 15:00, free until 16:00');
 assert.equal(pair(a,later),null);
 assert.equal(pair(a,b.replace('at 14:00','at 14:30'))?.confidence,'high');
 assert.equal(pair(a,b)?.confidence,'high');
});


test('generic campus title does not override an explicit meeting place in the body',()=>{
 const first=parseMatchPost({...p(a,'a'),title:'Campus request'});
 const second=parseMatchPost({...p(b,'b'),title:'Campus request'});
 assert.equal(comparePosts(first,second,now)?.confidence,'high');
 assert.equal(first.intents.find(i=>i.kind==='other')?.place,'campus-cafe-entrance');
});
