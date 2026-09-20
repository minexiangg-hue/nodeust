import assert from 'node:assert/strict';
import test from 'node:test';
import {studyFee} from '../../lib/match/study-fee.ts';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,body,title:'',category:'study',createdAt:now.toISOString()});
const a='Can teach COMP2011 pointers in English at library on 22 Sep 2026 from 14:00 to 15:00. HKD100 per hour.';
const b='Need a tutor for COMP2011 pointers in English at library on 22 Sep 2026 from 14:00 to 15:00. Budget HKD120 per hour.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('tutoring fees compare currency, rate basis and budget through the real parser',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('HKD120','HKD80')),null);
 assert.notEqual(pair(a,b.replace('HKD120','USD120'))?.confidence,'high');
 assert.notEqual(pair(a,b.replace('per hour','per session'))?.confidence,'high');
 assert.equal(pair(a,b.replace('Budget HKD120 per hour','Free help only')),null);
});
test('availability is not zero-cost tutoring and ambiguous charges stay unknown',()=>{
 assert.equal(studyFee('Free at library on Monday at 14:00','offer').fee,undefined);
 assert.equal(studyFee('not for free','offer').fee,undefined);
 assert.ok(studyFee('not for free','offer').missing.includes('study-fee'));
 assert.ok(studyFee('HKD100 or HKD200 per hour','offer').missing.length);
 assert.equal(studyFee('for free','offer').fee.amount,0);
});

test('one-session totals and explicit unpaid peer practice retain their stated scope',()=>{
 assert.equal(studyFee('one hour of tutoring, HK$90 total','seek').fee.basis,'session');
 assert.equal(studyFee('one-hour session HK$80 total','offer').fee.basis,'session');
 assert.equal(studyFee('不是收費補習','peer').fee.amount,0);
});
test('coaching and Chinese peer practice are recognised without inventing payment',()=>{
 assert.equal(pair(a.replace('teach','coach'),b)?.confidence,'high');
 const x='PHYS1112 study partner, English, library on 22 Sep 2026 from 14:00 to 15:00.';
 const y='PHYS1112 我想找同學一起練電場題，不是收費補習。英文，圖書館，9月22日14:00–15:00。';
 assert.equal(pair(x,y)?.confidence,'high');
});

test('thousands separators cannot turn expensive tutoring into a cheap offer',()=>{
 assert.equal(studyFee('HKD1,000 per hour','offer').fee.amount,1000);
 assert.equal(pair(a.replace('HKD100','HKD1,000'),b),null);
});
test('ranges, minimum quotes, negated quotes and extra costs remain unresolved',()=>{
 for(const quote of ['HKD100-200 per hour','at least HKD100 per hour','HKD100 per hour plus travel expenses','not HKD100 per hour','HKD1,00 per hour','GBP100 per hour']){
  assert.ok(studyFee(quote,'offer').missing.includes('study-fee'),quote);
  assert.notEqual(pair(a.replace('HKD100 per hour',quote),b)?.confidence,'high',quote);
 }
});

test('sentence punctuation after a price is not a malformed numeric separator',()=>{
 assert.equal(studyFee('HK$40，每人上限','seek').fee.amount,40);
 assert.equal(studyFee('HKD100. Per hour.','offer').fee.amount,100);
 assert.equal(studyFee('HKD1,00 per hour','offer').fee,undefined);
});
