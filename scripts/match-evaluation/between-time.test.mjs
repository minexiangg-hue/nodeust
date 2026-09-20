import assert from 'node:assert/strict';
import test from 'node:test';
import {extractSchedule} from '../../lib/match/text.ts';
const parse=body=>extractSchedule({id:'a',title:'',body,category:'goods',createdAt:'2026-09-11T04:00:00Z'});
test('between-and explicitly declares an interval, not two appointments',()=>{
 for(const timing of ['between 10:00 and 11:00','between 10 and 11','between 10am and 11am']){
  const result=parse('Collect on 26 Sep 2026 '+timing);
  assert.equal(result.ambiguous,false);assert.equal(result.minute,600);assert.equal(result.endMinute,660);
 }
 assert.equal(parse('Collect on 26 Sep 2026 at 10:00 and 11:00').ambiguous,true);
});
test('between ranges retain invalid-time and conflicting-time safeguards',()=>{
 for(const timing of ['between 11:00 and 10:00','between 10:00 and 25:00','between 10:00 and 11:00 or 15:00']){
  assert.equal(parse('Collect on 26 Sep 2026 '+timing).ambiguous,true);
 }
});
