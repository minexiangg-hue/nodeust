import assert from 'node:assert/strict';
import test from 'node:test';
import {TextCandidateIndex} from '../../lib/match/retrieval.ts';
const post=(id,body,extra={})=>({id,body,title:'',category:'other',createdAt:'2026-09-20T04:00:00Z',...extra});
test('unlisted objects and wrong categories remain retrievable without parser intents',()=>{
 const q=post('q','Need a hydrometer for my project',{category:'hall'});
 const index=new TextCandidateIndex([post('a','Spare hydrometer available',{category:'study'}),post('b','Badminton this evening')]);
 assert.equal(index.search(q)[0].id,'a');
 assert.deepEqual(Object.keys(index.search(q)[0]).sort(),['id','score']);
});
test('case/fullwidth, CJK overlap and spelling variation preserve lexical retrieval',()=>{
 const index=new TextCandidateIndex([post('a','出售咖啡研磨機'),post('b','HYDROMETER available')]);
 assert.equal(index.search(post('q','需要咖啡研磨機'))[0].id,'a');
 assert.equal(index.search(post('q','ｈｙｄｒｏｍｅｔｅｒ'))[0].id,'b');
 assert.equal(index.search(post('q','hydrometr'))[0].id,'b');
});
test('self, same owner, explicitly excluded owners and inactive records are filtered',()=>{
 const index=new TextCandidateIndex([post('a','hydrometer',{ownerId:'self'}),post('b','hydrometer',{ownerId:'blocked'}),post('c','hydrometer',{ownerId:'peer'}),post('d','hydrometer',{status:'removed'})]);
 assert.deepEqual(index.search(post('q','hydrometer',{ownerId:'self'}),{excludedOwners:new Set(['blocked'])}).map(r=>r.id),['c']);
 assert.deepEqual(index.search(post('q','hydrometer',{status:'removed'})),[]);
});
test('edits and removals leave the index equivalent to a fresh rebuild',()=>{
 const a=post('a','hydrometer'), b=post('b','badminton'), c=post('c','coffee grinder');
 const index=new TextCandidateIndex([a,b]);
 index.add({...a,body:'coffee grinder'});index.add(c);index.remove('b');index.remove('absent');
 const fresh=new TextCandidateIndex([{...a,body:'coffee grinder'},c]);
 for(const body of ['hydrometer','coffee grinder','badminton']) assert.deepEqual(index.search(post('q',body)),fresh.search(post('q',body)));
 index.add({...c,status:'removed'});
 assert.deepEqual(index.search(post('q','coffee')).map(r=>r.id),['a']);
});
test('insertion order does not affect ties; no overlap and zero limit do not invent results',()=>{
 const docs=[post('b','hydrometer'),post('a','hydrometer')],q=post('q','hydrometer');
 assert.deepEqual(new TextCandidateIndex(docs).search(q),new TextCandidateIndex([...docs].reverse()).search(q));
 assert.deepEqual(new TextCandidateIndex(docs).search(post('q','羽毛球')),[]);
 assert.deepEqual(new TextCandidateIndex(docs).search(q,{limit:0}),[]);
 assert.throws(()=>new TextCandidateIndex(docs).search(q,{limit:-1}),RangeError);
});
