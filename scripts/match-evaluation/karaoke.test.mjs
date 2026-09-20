import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const a='9月26日19:00–21:00 UG Hall III common room唱廣東歌，邀請同學加入，仲有2位，廣東話溝通；不飲酒，請接受全場無酒精。我可帶非本堂同學入場。';
const b='One student looking to join Cantonese karaoke. I agree to no alcohol. UG Hall III common room on 26 Sep 2026 from 19:00 to 21:00.';
const pair=body=>comparePosts(parseMatchPost(p(a,'a')),parseMatchPost(p(body,'b')),now);
test('karaoke preserves alcohol agreement alongside hall access and attendance',()=>{
 assert.equal(pair(b)?.confidence,'high');
 assert.notEqual(pair(b.replace('I agree to no alcohol.',''))?.confidence,'high');
 assert.equal(pair(b.replace('I agree to no alcohol.','I refuse an alcohol-free event.')),null);
 assert.equal(pair(b.replace('Hall III','Hall IV')),null);
 assert.equal(pair(b.replace('One student','Three students')),null);
});


test('a participant can require an alcohol-free event without assuming an unstated host policy',()=>{
 const guest=b.replace('Cantonese karaoke.','Cantonese karaoke without alcohol.');
 const compare=host=>comparePosts(parseMatchPost(p(host,'a')),parseMatchPost(p(guest,'b')),now);
 assert.equal(compare(a)?.confidence,'high');
 assert.notEqual(compare(a.replace('不飲酒，請接受全場無酒精。',''))?.confidence,'high');
 assert.equal(compare(a.replace('不飲酒，請接受全場無酒精。','Alcohol is allowed.')),null);
});

test('contradictory host rules are not a confident agreement',()=>{
 const host=a+' Alcohol is allowed.';
 const result=comparePosts(parseMatchPost(p(host,'a')),parseMatchPost(p(b,'b')),now);
 assert.notEqual(result?.confidence,'high');
 assert.ok(result?.missing.includes('alcohol-policy'));
});
