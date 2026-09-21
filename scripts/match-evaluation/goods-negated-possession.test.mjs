import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost} from '../../lib/match/engine.ts';
const parse=body=>parseMatchPost({id:'a',title:'',body,category:'goods',createdAt:'2026-09-11T04:00:00Z'}).intents;
test('negated possession is not converted into an offer by a following sale word',()=>{
 for(const body of ['沒有椅子出售。','没有椅子出售。','No chair for sale.','I do not have a chair for sale.']){
  assert.equal(parse(body).some(i=>i.entity==='chair'),false,body);
 }
 assert.ok(parse('椅子出售，HK$100。').some(i=>i.entity==='chair'&&i.side==='offer'));
 assert.ok(parse('Selling monitor HKD300. 沒有椅子出售。').some(i=>i.entity==='monitor'&&i.side==='offer'));
});

// A title supplies context, not authority to overwrite a denial in the body.
test('sale/request titles never resurrect explicitly absent body entities',()=>{
 for (const title of ['Selling calculator', 'Calculator wanted', '放計數機', 'Looking to buy']) {
  for (const body of ['沒有 FX-991EX。','没有 FX-991EX。',"I do not have a FX-991EX.","No FX-991EX for sale."]) {
   const items=parseMatchPost({id:'x',title,body,category:'goods',createdAt:'2026-09-11T04:00:00Z'}).intents;
   assert.equal(items.some(i=>i.model==='fx991ex'),false,`${title}: ${body}`);
  }
 }
});
test('inability to use a named alternative is not a request for that alternative',()=>{
 for (const phrase of ['cannot use','cannot accept',"can't use",'could not use','不能用','不接受']) {
  const items=parse(`Want FX-991EX only, ${phrase} FX-82MS for my course. Budget HKD150.`);
  assert.ok(items.some(i=>i.model==='fx991ex'&&i.side==='seek'),phrase);
  assert.equal(items.some(i=>i.model==='fx82ms'&&i.side==='seek'),false,phrase);
 }
 // Not usable by its current owner is distinct from not available for sale.
 assert.ok(parse('I cannot use my FX-82MS, for sale HKD50.').some(i=>i.model==='fx82ms'&&i.side==='offer'));
});

test('use exclusions also apply to inherited buying roles without erasing selling roles',()=>{
 const body='I cannot use my FX-82MS, HKD50.';
 const result=title=>parseMatchPost({id:'x',title,body,category:'goods',createdAt:'2026-09-11T04:00:00Z'}).intents;
 assert.equal(result('Calculator wanted').some(i=>i.model==='fx82ms'),false);
 assert.ok(result('Calculator for sale').some(i=>i.model==='fx82ms'&&i.side==='offer'));
});
