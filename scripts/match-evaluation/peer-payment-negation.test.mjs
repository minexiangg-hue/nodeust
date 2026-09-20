import test from 'node:test';
import assert from 'node:assert/strict';
import {studyFee} from '../../lib/match/study-fee.ts';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-19T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'study',createdAt:now.toISOString()});
const base='Looking for a COMP2012 study partner for recursion at LG1 on 25 Sep 2026, 14:00–15:00. English.';
test('peer requests can explicitly exclude paid tutoring without an unknown fee',()=>{
 assert.deepEqual(studyFee('No paid tutoring.','peer'),{missing:[]});
 assert.equal(comparePosts(p(base+' Free peer study.','a'),p(base+' No paid tutoring.','b'),now)?.confidence,'high');
});
test('the peer-only exclusion does not erase actual or unresolved payment conditions',()=>{
 assert.ok(studyFee('No paid tutoring.','seek').missing.length);
 assert.ok(studyFee('No paid tutoring. Payment required.','peer').missing.length);
 assert.equal(studyFee('No paid tutoring. HKD 100 per hour.','peer').fee.amount,100);
 assert.notEqual(comparePosts(p(base,'a'),p(base+' No paid tutoring. HKD 100 per hour.','b'),now)?.confidence,'high');
 assert.ok(studyFee('No paid tutoring unless a fee is agreed.','peer').missing.length);
});
