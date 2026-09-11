import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSchedule } from '../../lib/match/text.ts';
const p = body => ({ id:'x', category:'other', title:'', body, createdAt:'2026-09-11T17:00:00Z' });
test('relative date uses Hong Kong date at posting, including midnight rollover',()=>{
 assert.deepEqual(extractSchedule(p('tmr at 18:30')),{date:'2026-09-13',minute:1110,endMinute:undefined,ambiguous:false});
 assert.equal(extractSchedule(p('后天 下午6點半')).date,'2026-09-14');
 assert.equal(extractSchedule(p('后天 下午6點半')).minute,1110);
});
test('ambiguous and invalid dates do not become a confident appointment',()=>{
 assert.equal(extractSchedule(p('2026-02-30 at 18:00')).ambiguous,true);
 assert.equal(extractSchedule(p('9/10 18:00')).ambiguous,true);
 assert.equal(extractSchedule(p('2026-09-14 or 2026-09-15 18:00')).date,undefined);
 assert.equal(extractSchedule(p('maybe tomorrow at 18:00')).ambiguous,true);
});
test('explicit dates and independent language notation agree',()=>{
 assert.equal(extractSchedule(p('September 14, 2026 6pm')).date,'2026-09-14');
 assert.equal(extractSchedule(p('September 14, 2026 6pm')).minute,1080);
 assert.equal(extractSchedule(p('2026年9月14日 晚上六點')).minute,1080);
});
test('compact dates and hour ranges retain both endpoints',()=>{
 for(const body of ['on12Sep15:00–16:00','12Sep2026 depart15:00–16:00','9月12日15点到16点']) {
  const result=extractSchedule(p(body));assert.equal(result.date,'2026-09-12',body);assert.equal(result.minute,900,body);assert.equal(result.endMinute,960,body);assert.equal(result.ambiguous,false,body);
 }
 assert.equal(extractSchedule(p('tomorrow17:00')).date,'2026-09-13');
 assert.equal(extractSchedule(p('Sep17 at17:00')).date,'2026-09-17');
 assert.equal(extractSchedule(p('Not leaving at16:00 anymore. Updated:12Sep17:00')).minute,1020);
});
test('day-month notation consumes its month before adjacent appointment hours',()=>{
 for(const [body,date,minute]of [['Pickup 12 Sep 11:00 at HKUST North Gate.','2026-09-12',660],['Campus library 14 Sep 16:00.','2026-09-14',960],['12 September 2026 11:00','2026-09-12',660]]){
  const result=extractSchedule(p(body));assert.equal(result.date,date,body);assert.equal(result.minute,minute,body);assert.equal(result.ambiguous,false,body);
 }
});
test('noon and midnight are explicit clock times',()=>{
 for(const body of ['North Gate at noon on Sep12.','13Sep noon at HKUST North Gate.','Sep12 at midday'])assert.equal(extractSchedule(p(body)).minute,720,body);
 assert.equal(extractSchedule(p('Sep12 at midnight')).minute,0);
});
test('current and next calendar weeks use a Monday start and retain past days',()=>{
 const onFriday=body=>({...p(body),createdAt:'2026-09-11T04:00:00Z'});
 for(const body of ['下周一下午3点','下星期一下午3点','next Monday at 15:00'])assert.equal(extractSchedule(onFriday(body)).date,'2026-09-14',body);
 for(const body of ['本周一下午3点','这周一下午3点','this Monday at 15:00'])assert.equal(extractSchedule(onFriday(body)).date,'2026-09-07',body);
 assert.equal(extractSchedule(onFriday('星期一下午3点')).date,'2026-09-14');
});
test('explicit weekday contradiction is uncertain but excluded weekdays do not conflict',()=>{
 assert.equal(extractSchedule(p('Saturday 2026-09-14 at 15:00')).ambiguous,true);
 assert.equal(extractSchedule(p('Saturday 2026-09-12 at 15:00, no Sunday availability.')).ambiguous,false);
 assert.equal(extractSchedule(p('2026-09-12 Saturday at 15:00; Sunday impossible.')).ambiguous,false);
});
test('range AM and PM are evaluated independently at both endpoints',()=>{
 for(const [body,start,end]of [['9月12日 9am–10pm',540,1320],['9月12日 11am–1pm',660,780],['Sep12 3–5pm',900,1020],['Sep12 9:30am–1:15pm',570,795]]){
  const result=extractSchedule(p(body));assert.equal(result.minute,start,body);assert.equal(result.endMinute,end,body);assert.equal(result.ambiguous,false,body);
 }
});
test('an unresolved or unsupported timezone prevents definite time compatibility',()=>{
 for(const body of ['9月12日19:00，时区没定，可能是香港也可能纽约时间','Sep12 at19:00; timezone undecided.','Sep12 at19:00, not decided whether Hong Kong or destination time.','Sep12 at19:00 EST']){
  const result=extractSchedule(p(body));assert.equal(result.ambiguous,true,body);assert.equal(result.minute,undefined,body);
 }
 for(const body of ['Sep12 at19:00 HKT','Sep12 at19:00 UTC+8','Sep12 at19:00 UTC+08:00','Sep12 at19:00 Hong Kong time'])assert.equal(extractSchedule(p(body)).ambiguous,false,body);
});
test('court and table numbers are not calendar days',()=>{
 for(const body of ['9月12日18:00–19:00科大LG1羽毛球場1號','9月12日15:00–16:00科大LG1乒乓球台2号'])assert.equal(extractSchedule(p(body)).date,'2026-09-12',body);
});
test('unrelated numeric ranges cannot turn separate time mentions into availability',()=>{
 const result=extractSchedule(p('2026-09-14. Lecture at 17:00. Dinner at 19:00. Need 1-2 people.'));
 assert.equal(result.ambiguous,true);assert.equal(result.minute,undefined);
 assert.equal(extractSchedule(p('9月14日午夜十二點')).minute,0);
 assert.equal(extractSchedule(p('9月14日中午十二點')).minute,720);
});
