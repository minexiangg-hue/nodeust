import assert from 'node:assert/strict';
import test from 'node:test';
import { compareIntents, missingIntentDetails } from '../../lib/match/engine.ts';
import { parseResidenceLabel } from '../../lib/match/constraints.ts';
const now = new Date('2026-09-11T04:00:00Z');
const a = {kind:'hall',entity:'ug-hall-1->ug-hall-2',side:'swap',from:'ug-hall-1',to:'ug-hall-2',term:'fall:2026',room:'single',wantedRoom:'double',eligibility:'male',evidence:['explicit rooms'],missing:[]};
const b = {...a,entity:'ug-hall-2->ug-hall-1',from:'ug-hall-2',to:'ug-hall-1',room:'double',wantedRoom:'single'};

test('canonical residence labels preserve both academic years and exact date endpoints',()=>{
 assert.deepEqual(parseResidenceLabel('academic:2026-2027'),{type:'academic-year',startYear:2026,endYear:2027});
 assert.deepEqual(parseResidenceLabel('dates:2026-09-01/2027-08-31'),{type:'dates',start:'2026-09-01',end:'2027-08-31'});
 for(const value of ['fall','academic:2026-2026','dates:2026-02-30/2026-09-01','dates:2027-01-01/2026-01-01'])assert.equal(parseResidenceLabel(value),undefined);
});
test('housing swaps require the complete same occupancy period and preserve unknown calendars',()=>{
 assert.equal(compareIntents(a,b,now)?.confidence,'high');
 const year={...a,term:'academic:2026-2027'};
 assert.equal(compareIntents(year,{...b,term:year.term},now)?.confidence,'high');
 assert.equal(compareIntents(year,{...b,term:'academic:2027-2028'},now),null);
 assert.equal(compareIntents(year,b,now)?.confidence,'possible');
 const dates={...a,term:'dates:2026-09-01/2027-08-31'};
 assert.equal(compareIntents(dates,{...b,term:'dates:2026-09-01/2026-12-31'},now),null);
 const seasonal=compareIntents({...a,term:'fall'},{...b,term:'fall'},now);
 assert.equal(seasonal?.confidence,'high');
 assert.ok(seasonal.reasons.some(reason=>reason.code==='term-year-unspecified'));
 assert.equal(compareIntents({...a,term:'fall'},b,now)?.confidence,'possible');
 assert.equal(compareIntents({...a,term:'fall'},{...b,term:'spring'},now),null);
});
test('explicit any and allowed-room sets accept known rooms without inventing unknown actual rooms',()=>{
 assert.equal(compareIntents({...a,wantedRoom:'any'},b,now)?.confidence,'high');
 const choices={...a,wantedRoom:undefined,wantedRooms:['single','double']};
 assert.equal(compareIntents(choices,b,now)?.confidence,'high');
 assert.equal(missingIntentDetails(choices).includes('wantedRoom'),false);
 assert.equal(compareIntents({...choices,wantedRooms:['single','triple']},b,now),null);
 assert.equal(compareIntents({...a,room:undefined},b,now)?.confidence,'possible');
 assert.equal(compareIntents({...a,room:'any'},b,now)?.confidence,'possible');
});

test('explicitly finished residence periods cannot drive a current housing recommendation',()=>{
 const expired={...a,term:'dates:2025-09-01/2026-08-31'};
 assert.equal(compareIntents(expired,{...b,term:expired.term},now),null);
 const ending={...a,term:'dates:2026-09-01/2026-09-11'};
 assert.equal(compareIntents(ending,{...b,term:ending.term},new Date('2026-09-11T15:59:59Z'))?.confidence,'high');
 assert.equal(compareIntents(ending,{...b,term:ending.term},new Date('2026-09-11T16:00:00Z')),null);
 const lastYear={...a,term:'academic:2024-2025'};
 assert.equal(compareIntents(lastYear,{...b,term:lastYear.term},now),null);
});


test('denied allocations and ineligible swaps conflict, pending author claims stay possible', () => {
 const a={kind:'hall',side:'swap',entity:'housing',from:'ug-hall-1',to:'ug-hall-2',room:'double',wantedRoom:'double',term:'fall:2026',eligibility:'male',allocation:'confirmed',exchangeEligibility:'eligible',evidence:['public author claim'],missing:[]};
 const b={...a,from:'ug-hall-2',to:'ug-hall-1'};
 const now=new Date('2026-09-11T04:00:00Z');
 assert.equal(compareIntents(a,b,now)?.confidence,'high');
 assert.equal(compareIntents(a,{...b,allocation:'pending'},now)?.confidence,'possible');
 assert.equal(compareIntents(a,{...b,exchangeEligibility:'pending'},now)?.confidence,'possible');
 assert.equal(compareIntents(a,{...b,allocation:'denied'},now),null);
 assert.equal(compareIntents(a,{...b,exchangeEligibility:'ineligible'},now),null);
});

test('negated room choices cannot reappear as high-confidence single-room acceptance',async()=>{
 const {parseMatchPost,comparePosts}=await import('../../lib/match/engine.ts');
 const p=(body,id)=>({id,ownerId:id,title:'',body,category:'hall',createdAt:'2026-09-11T04:00:00Z'});
 const source='Male UG currently UG Hall VI double, full year 2028/29. Looking for UG Hall IX, single or double both okay.';
 const other='Male UG currently UG Hall IX single, full year 2028/29. Looking for UG Hall VI double.';
 const compare=text=>comparePosts(parseMatchPost(p(text,'a')),parseMatchPost(p(other,'b')),new Date('2026-09-11T04:00:00Z'));
 assert.equal(compare(source)?.confidence,'high');
 assert.notEqual(compare(source.replace('single or double','not single or double'))?.confidence,'high');
});

test('accepted room alternatives can complete a reciprocal full-year exchange',async()=>{
 const {parseMatchPost,comparePosts}=await import('../../lib/match/engine.ts');
 const p=(body,id)=>({id,ownerId:id,title:'',body,category:'hall',createdAt:'2026-09-11T04:00:00Z'});
 const a='Male undergraduate allocated UG Hall VI, double, full year 2028/29. Looking for UG Hall IX, single or double both okay. Eligible for room swap.';
 const b='Male UG, allocated single in UG Hall IX for all of 2028/29; I would take a double in UG Hall VI. Eligible for official exchange.';
 const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),new Date('2026-09-11T04:00:00Z'));
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('2028/29','2029/30')),null);
 assert.equal(pair(a,b.replace('allocated single','allocated triple')),null);
});
