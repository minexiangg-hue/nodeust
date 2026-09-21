import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchIndex,parseMatchPost,rankMatches} from '../../lib/match/engine.ts';
const post=(id,body)=>({id,ownerId:id,title:'',body,category:'other',createdAt:'2026-09-21T04:00:00Z',status:'active'});
test('text discovery never promotes overlap to a compatible match',()=>{
 const a=post('a','Looking for an astrolabe'),b=post('b','Astrolabe exhibit notes');
 const index=new MatchIndex([a,b]),own=[parseMatchPost(a)];
 assert.ok(index.candidates(own).has('b'));
 assert.deepEqual(rankMatches(own,[parseMatchPost(b)]),[]);
 assert.ok(!index.candidates(own,new Set(['b'])).has('b'));
});
test('index replacement removes old entity and lexical postings',()=>{
 const a=post('a','Looking for an astrolabe'),b=post('b','Astrolabe exhibit notes');
 const index=new MatchIndex([a,b]);
 index.add(parseMatchPost(post('b','Unrelated telescope announcement')));
 assert.ok(!index.candidates([parseMatchPost(a)]).has('b'));
});
