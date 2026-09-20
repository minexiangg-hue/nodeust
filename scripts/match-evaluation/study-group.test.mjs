import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,body,title:'',category:'study',createdAt:now.toISOString()});
const a='We are two CHEM1010 learners reviewing chemical bonding. One more peer welcome, English, library on 26 Sep 2026 from 15:00 to 16:00.';
const b='One CHEM1010 student hoping to join peer flashcard practice on chemical bonding. English, library, 26 Sep 2026 from 15:00 to 16:00.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('study-group vacancies limit joining students, not the existing group size',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('One CHEM1010 student','Two CHEM1010 students')),null);
 assert.equal(pair(a.replace('One more','Zero more'),b),null);
 assert.notEqual(pair(a,b.replace('One CHEM1010 student','A CHEM1010 learner'))?.confidence,'high');
});


test('explicit peer requests allow a course and topic between role and practice',()=>{
 const host='Seeking a peer for COMP1022 loops practice, Mandarin or English both work. Zoom, 26 Sep 2026, 18:00–19:00. I am learning too.';
 const guest='我是 COMP1022 初學者，想找同學一起練 Python loops。只能普通話討論，9月26日18:00–19:00可以 Zoom。';
 assert.equal(pair(host,guest)?.confidence,'high');
 assert.equal(pair(host,guest.replace('COMP1022','COMP2012')),null);
 assert.equal(pair(host,guest.replace('普通話','廣東話')),null);
 assert.notEqual(pair(host.replace('Seeking a peer','Not seeking a peer'),guest)?.confidence,'high');
 const tutor=host.replace('Seeking a peer','Seeking a tutor');
 assert.equal(parseMatchPost(p(tutor,'a')).intents.find(i=>i.kind==='study')?.side,'seek');
});


test('body learning and tutoring roles do not require a descriptive title',()=>{
 const peer=parseMatchPost(p('Taking PHYS1113; want another learner to work through electric field problems with. English, library, 26 Sep 2026, 10:00–11:00.','a'));
 assert.ok(peer.intents.some(i=>i.kind==='study'&&i.side==='peer'));
 const learner=parseMatchPost(p('MATH1014 learner needs one hour of tutoring on limits, English, at most HK$100 total. Library on 26 Sep 2026, 16:00–17:00.','b'));
 assert.ok(learner.intents.some(i=>i.kind==='study'&&i.side==='seek'));
});
