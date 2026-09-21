import test from 'node:test';
import assert from 'node:assert/strict';
import {openStudyTopic} from '../../lib/match/open-study-topic.ts';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
test('unlisted study topics retain exact author words, not topic-table guesses',()=>{
 assert.equal(openStudyTopic('I can teach thermodynamics at the library'),'text-subject:thermodynamics');
 assert.equal(openStudyTopic('Looking for a partner to study thermodynamics together'),'text-subject:thermodynamics');
 for(const text of ['I can teach you','I study with friends','I do not teach thermodynamics','I study topology. I teach acoustics.'])assert.equal(openStudyTopic(text),undefined,text);
});
test('unfamiliar explicit subjects may be discussed but never become confirmed matches',()=>{
 const p=(id,body)=>parseMatchPost({id,ownerId:id,title:'',body,category:'other',createdAt:'2026-09-21T04:00:00Z',status:'active'});
 const a=p('a','I can teach thermodynamics at the library'),b=p('b','Looking for a study partner to study thermodynamics together'),c=p('c','Need a tutor to teach thermodynamics at the library');
 assert.equal(comparePosts(a,b),null,'teacher and peer request are different roles');
 assert.equal(comparePosts(a,c)?.confidence,'possible');
 assert.equal(comparePosts(a,p('d','Need a tutor to teach acoustics at the library')),null);
});
