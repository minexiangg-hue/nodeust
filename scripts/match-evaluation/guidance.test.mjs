import test from 'node:test';
import assert from 'node:assert/strict';
import {ownPostGuidance} from '../../lib/match/guidance.ts';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'goods',createdAt:now.toISOString()});
test('author guidance surfaces missing currency without mutating match facts',()=>{
 const buyer=p('Looking to buy a monitor, budget 250.','buyer');
 const before=JSON.stringify(buyer);
 assert.ok(ownPostGuidance([buyer])[0].missing.includes('currency'));
 assert.equal(JSON.stringify(buyer),before);
 const free=p('Giving away a monitor for free.','seller');
 assert.equal(comparePosts(buyer,free,now)?.confidence,'high');
 assert.equal(ownPostGuidance([free]).some(p=>p.missing.includes('currency')),false);
 const explicit=p('Looking to buy a monitor, budget HKD 250.','buyer');
 assert.equal(ownPostGuidance([explicit]).some(p=>p.missing.includes('currency')),false);
});
test('a complete intent does not hide a second request that needs clarification',()=>{
 const row={post:{id:'own',title:'Two requests'},warnings:[],intents:[
  {kind:'goods',price:100,currency:'HKD',missing:[]},
  {kind:'study',missing:['course','time']},
 ]};
 assert.deepEqual(ownPostGuidance([row]),[{id:'own',title:'Two requests',missing:['course','time']}]);
 assert.deepEqual(ownPostGuidance([{post:row.post,intents:[],warnings:['describe-request']}])[0].missing,['describe-request']);
});
