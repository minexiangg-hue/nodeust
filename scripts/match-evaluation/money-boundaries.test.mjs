import assert from 'node:assert/strict';
import test from 'node:test';
import {parseGoods} from '../../lib/match/housing-goods.ts';
const parse=body=>parseGoods({id:'money',title:'Selling calculator',body,category:'goods',createdAt:'2026-09-18T00:00:00Z'});

test('adjacent calendar and clock fields never become part of a quoted amount',()=>{
 for (const amount of [5,75,120,999,1200,15000]) for (const year of [2026,2029,2031]) {
  for (const price of [String(amount),amount.toLocaleString('en-US')]) {
   for (const separator of [',','，']) {
    const body=`Calculator HKD${price}${separator}${year}年9月21日交收。`;
    assert.equal(parse(body)[0]?.price,amount,body);
   }
  }
 }
 for(const tail of ['2029-09-21 pickup','2029/09/21 pickup','9月21日交收','14:00 pickup'])
  assert.equal(parse(`Calculator HKD120,${tail}`)[0]?.price,120,tail);
});
test('legal grouped amounts, decimal cents and suffix currencies remain intact',()=>{
 for(const [token,amount] of [['HKD1,200',1200],['HK$1,200.50',1200.5],['1,200.50HKD',1200.5],['120港幣',120],['HKD120.05',120.05]])
  assert.equal(parse(`Calculator ${token}.`)[0]?.price,amount,token);
});
test('malformed numbers cannot be interpreted as convenient numeric prefixes or suffixes',()=>{
 for(const token of ['HKD1,2000','1,2000HKD','HKD120.123','120.123HKD','HKD-20','-20HKD','HKD1,20','1,20HKD']) {
  const item=parse(`Calculator ${token}.`)[0];
  assert.equal(item?.price,undefined,token);
  assert.ok(item?.missing.some(code=>code==='price'||code==='price_ambiguous'),token);
 }
});

test('malformed additional amounts cannot be hidden by free or a valid quote',()=>{
 for(const body of ['Free calculator, HKD120.123.', 'Calculator HKD100 and HKD0.123 fee.', 'Free calculator, -20HKD.']) {
  const item=parse(body)[0];
  assert.equal(item?.price,undefined,body);
  assert.ok(item?.missing.includes('price_ambiguous'),body);
 }
});

test('punctuation before suffix-currency amounts is not a malformed grouping',()=>{
 for(const body of ['Calculator,120HKD.', '計數機，120港幣。', 'Calculator 120HKD 2029年9月21日交收。'])
  assert.equal(parse(body)[0]?.price,120,body);
});
