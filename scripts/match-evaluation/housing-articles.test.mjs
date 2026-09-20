import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost} from '../../lib/match/engine.ts';
const p=body=>({id:'a',ownerId:'a',title:'',body,category:'hall',createdAt:'2026-09-11T04:00:00Z'});
test('room possession preserves optional English articles',()=>{
 for(const phrase of ['I hold','I hold a','I have','I have a']){
 const intent=parseMatchPost(p(`${phrase} PG Hall 3 single for 1 Sep 2026–31 Aug 2027 and need a PG Hall 1 single. Male postgraduate.`)).intents.find(i=>i.kind==='hall');
 assert.equal(intent?.from,'pg-hall-3');assert.equal(intent?.to,'pg-hall-1');assert.equal(intent?.room,'single');
 assert.equal(intent?.allocation,undefined);
 }
});
test('seeking triggers a reciprocal housing request without requiring the word swap',()=>{
 const intent=parseMatchPost(p('Male postgraduate, confirmed PG Hall 3 single, fall 2026. Seeking a PG Hall 1 single.')).intents.find(i=>i.kind==='hall');
 assert.equal(intent?.from,'pg-hall-3');assert.equal(intent?.to,'pg-hall-1');
});


test('complete academic-year wording preserves explicit period and negation',()=>{
 const base='Male undergraduate; confirmed UG Hall VI double for the complete 2028/29 year. Seeking a UG Hall II double.';
 const term=body=>parseMatchPost(p(body)).intents.find(i=>i.kind==='hall')?.term;
 assert.equal(term(base),'academic:2028-2029');
 assert.equal(term(base.replace('complete','entire')),'academic:2028-2029');
 assert.equal(term(base.replace('the complete','not the complete')),undefined);
 assert.equal(term(base.replace('complete 2028/29 year','full year 2028/29').replace('the full','not the full')),undefined);
 assert.equal(term(base.replace('2028/29','2028/30')),undefined);
 assert.equal(term(base+' Fall only.'),undefined);
});
