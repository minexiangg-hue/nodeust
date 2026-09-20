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
