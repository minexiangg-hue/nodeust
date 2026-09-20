import assert from 'node:assert/strict';
import test from 'node:test';
import {residenceDateRange} from '../../lib/match/residence-text.ts';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const post=(body,id)=>({id,ownerId:id,body,title:'',category:'hall',createdAt:'2026-09-11T04:00:00Z'});
const a='I hold PG Hall 1 single for 1 Sep 2028–31 Aug 2029 and need a PG Hall 2 single. Male postgraduate, eligible for exchange.';
const b='男研究生，PG Hall 2 單人房已有分配，住宿期 2028-09-01 至 2029-08-31，想去 PG Hall 1 單人房。我有換房資格。';
const pair=(x,y)=>comparePosts(parseMatchPost(post(x,'a')),parseMatchPost(post(y,'b')),new Date('2026-09-11T04:00:00Z'));
test('explicit multilingual residence ranges preserve complete equal intervals',()=>{
 assert.equal(residenceDateRange(a.toLowerCase()).term,'dates:2028-09-01/2029-08-31');
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('2029-08-31','2029-07-31')),null);
 assert.equal(pair(a,b.replace('2028-09-01','2028-10-01')),null);
});
test('unknown, invalid, reversed, negated and alternative ranges cannot collapse to one period',()=>{
 for(const s of ['2028-02-30 to 2028-09-01','2029-09-01 to 2028-09-01','not 2028-09-01 to 2029-08-31','2028-09-01 to 2029-08-31 or 2028-09-01 to 2028-12-31'])
 assert.equal(residenceDateRange(s).term,undefined,s);
 assert.equal(residenceDateRange('1 Sep to 31 Aug').term,undefined);
});

test('month-level residence periods compare at stated precision without invented dates',async()=>{
 const {residenceMonthRange}=await import('../../lib/match/residence-text.ts');
 const {compareResidencePeriods,parseResidenceLabel}=await import('../../lib/match/constraints.ts');
 const en=residenceMonthRange('September 2028 through August 2029').term;
 assert.equal(en,'months:2028-09/2029-08');
 assert.equal(residenceMonthRange('2028年9月至2029年8月').term,en);
 const period=parseResidenceLabel(en);
 assert.equal(compareResidencePeriods(period,period,'equal').status,'compatible');
 assert.equal(compareResidencePeriods(period,parseResidenceLabel('months:2028-09/2029-07'),'equal').status,'conflict');
 assert.equal(compareResidencePeriods(period,parseResidenceLabel('dates:2028-09-01/2029-08-31'),'equal').status,'unknown');
 for(const text of ['2028年13月至2029年8月','2029年9月至2028年8月','not September 2028 through August 2029','1 September 2028 through August 2029'])assert.equal(residenceMonthRange(text).term,undefined,text);
});

test('month-level stays expire only after the declared final month in Hong Kong time',async()=>{
 const {isExpired}=await import('../../lib/match/engine.ts');
 const intent={kind:'hall',entity:'route',side:'swap',term:'months:2028-09/2029-08',evidence:[],missing:[]};
 assert.equal(isExpired(intent,new Date('2029-08-31T15:59:59Z')),false);
 assert.equal(isExpired(intent,new Date('2029-08-31T16:00:00Z')),true);
});
