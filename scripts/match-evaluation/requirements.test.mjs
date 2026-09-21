import assert from 'node:assert/strict';
import test from 'node:test';
import {compareRequirements} from '../../lib/match/requirements.ts';
import {compareIntents, parseMatchPost, comparePosts} from '../../lib/match/engine.ts';
const evidence=['Explicit public assertion'];
const req=(key,op,value,unit)=>({key,op,value,unit,evidence});
const claim=(key,value,unit)=>({key,value,unit,evidence});
const status=(r,c)=>compareRequirements([r],c)[0].status;

test('arbitrary requirement keys preserve affirmation, exclusion and unknowns',()=>{
 for (const key of ['item-authenticity','model','wheelchair-access','custom-fact-872','__proto__']) {
  assert.equal(status(req(key,'eq',true),[claim(key,true)]),'compatible');
  assert.equal(status(req(key,'eq',true),[claim(key,false)]),'conflict');
  assert.equal(status(req(key,'eq',true),[]),'unknown');
  assert.equal(status(req(key,'eq',true),[claim(key,null)]),'unknown');
  assert.equal(status(req(key,'neq','excluded'),[claim(key,'excluded')]),'conflict');
  assert.equal(status(req(key,'neq','excluded'),[]),'unknown');
  assert.equal(status(req(key,'neq','excluded'),[claim(key,'accepted')]),'compatible');
 }
});
test('numeric thresholds are monotonic and cannot silently convert units or types',()=>{
 for(let threshold=0;threshold<20;threshold++) for(let actual=0;actual<20;actual++) {
  assert.equal(status(req('weight','lte',threshold,'kg'),[claim('weight',actual,'kg')]),actual<=threshold?'compatible':'conflict');
  assert.equal(status(req('weight','gte',threshold,'kg'),[claim('weight',actual,'kg')]),actual>=threshold?'compatible':'conflict');
 }
 for (const c of [claim('weight',10,'lb'),claim('weight',10),claim('weight','10','kg'),claim('weight',NaN,'kg')])
  assert.equal(status(req('weight','lte',20,'kg'),[c]),'unknown');
});
test('alternatives, contradictory facts and unsupported assertions retain uncertainty',()=>{
 const r=req('format','in',['paper','digital']);
 assert.equal(status(r,[claim('format','paper')]),'compatible');
 assert.equal(status(r,[claim('format','audio')]),'conflict');
 assert.equal(status(r,[claim('format','paper'),claim('format','audio')]),'unknown');
 assert.equal(status(r,[claim('format','paper'),claim('format',null)]),'unknown');
 assert.equal(status({...r,evidence:[]},[claim('format','paper')]),'unknown');
 assert.equal(status(r,[{...claim('format','paper'),evidence:[]}]),'unknown');
 assert.equal(status({...r,op:'execute'},[claim('format','paper')]),'unknown');
 assert.equal(status({...r,value:[]},[claim('format','paper')]),'unknown');
});
const intent=(side,extra={})=>({kind:'goods',entity:'headphones',side,price:100,currency:'HKD',evidence,missing:[],...extra});
const now=new Date('2026-09-20T04:00:00Z');
test('the live comparison path checks both directions without inferring counterpart facts',()=>{
 const wanted=intent('seek',{requirements:[req('item-authenticity','eq',true)]});
 for (const [value,expected] of [[true,'high'],[false,null],[null,'possible'],[undefined,'possible']]) {
  const offered=intent('offer',value===undefined?{}:{claims:[claim('item-authenticity',value)]});
  for(const [a,b] of [[wanted,offered],[offered,wanted]]) {
   const result=compareIntents(a,b,now);
   assert.equal(result?.confidence??null,expected);
   if(expected==='possible') assert.ok(result.missing.includes('requirement:item-authenticity'));
  }
 }
 const seller=intent('offer',{requirements:[req('pickup-ability','eq',true)]});
 assert.equal(compareIntents(seller,intent('seek'),now)?.confidence,'possible');
 assert.equal(compareIntents(seller,intent('seek',{claims:[claim('pickup-ability',false)]}),now),null);
});
let nextId=0;
const post=(body,id=`p-${nextId++}`)=>parseMatchPost({id,body,title:'',category:'goods',createdAt:now});
test('public goods text carries genuine-only requirements through to actual matching',()=>{
 const buyer=post('Buying genuine headphones, no replicas, up to HKD 300.','buyer');
 for(const [body,expected] of [
  ['Selling genuine headphones HKD200.','high'],
  ['Selling replica headphones HKD200.',null],
  ['Selling headphones HKD200.','possible'],
  ['耳機售HKD200，朋友送的，真偽唔清楚。','possible'],
  ['Selling headphones HKD200, not genuine.',null],
  ['Selling headphones HKD200, might be genuine.','possible'],
  ['Selling headphones HKD200, genuine but also fake.','possible'],
 ]) {
  const seller=post(body,'seller');
  assert.equal(comparePosts(buyer,seller,now)?.confidence??null,expected,body);
 }
});
test('authenticity constraints stay with their item and are not mandatory for every buyer',()=>{
 const [chair,headphones]=post('Selling a genuine chair HKD100; selling headphones HKD100.').intents.filter(i=>i.kind==='goods');
 assert.equal(chair.claims?.[0].value,true);
 assert.equal(headphones.claims,undefined);
 const buyer=post('Buying headphones up to HKD300.');
 assert.equal(comparePosts(buyer,post('Selling headphones HKD100.'),now)?.confidence,'high');
 const flexible=post('Buying headphones, genuine or replicas okay, up to HKD300.');
 assert.equal(comparePosts(flexible,post('Selling replica headphones HKD100.'),now)?.confidence,'high');
});
