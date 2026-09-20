import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'goods',createdAt:now.toISOString()});
const a='有全新8mm瑜伽墊免費送，9月26日19:00在體育館正門交收。';
const b='Would like to take a free unused yoga mat, at least 7 mm thick. I can collect at sports centre main entrance on 26 Sep 2026 at 19:00.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('explicit mat thickness is converted and compared against a minimum',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('sports centre main entrance','library')),null);
 assert.notEqual(pair(a.replace('免費送','不免費送'),b)?.confidence,'high');
 assert.equal(pair(a.replace('8mm','0.8cm'),b)?.confidence,'high');
 assert.equal(pair(a.replace('8mm','6mm'),b),null);
 assert.notEqual(pair(a.replace('8mm',''),b)?.confidence,'high');
 assert.notEqual(pair(a,b.replace('at least','about'))?.confidence,'high');
});

test('widths and malformed or ranged dimensions cannot become exact thickness',()=>{
 for(const value of ['80cm寬','-8mm','6-8mm','8mm至10mm']){
  assert.notEqual(pair(a.replace('8mm',value),b)?.confidence,'high',value);
 }
 assert.notEqual(pair(a,b.replace('7 mm thick','70 cm wide'))?.confidence,'high');
});
