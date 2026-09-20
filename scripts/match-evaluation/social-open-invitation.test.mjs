import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>parseMatchPost({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const invite='Looking for walking company at campus sundial on 26 Sep 2026 at 08:00. English.';
const join='I want to join a walk at campus sundial on 26 Sep 2026 at 08:00. English.';
const compare=(a,b)=>comparePosts(p(a,'a'),p(b,'b'),now);
test('seeking company complements joining without invented party or unlimited capacity',()=>{
 assert.equal(compare(invite,join)?.confidence,'high');
 assert.equal(compare(join,invite)?.confidence,'high');
 assert.equal(compare(join,join),null);
 assert.equal(p(join,'b').intents[0].party,undefined);
 assert.equal(p(invite,'a').intents[0].unlimitedPlaces,false);
});
test('explicit attendance restrictions require counts and reject overflow',()=>{
 assert.notEqual(compare(invite+' Limited places.',join)?.confidence,'high');
 assert.notEqual(compare(invite+' One more student welcome.',join)?.confidence,'high');
 assert.equal(compare(invite+' One more student welcome.',join+' Just me.')?.confidence,'high');
 assert.equal(compare(invite+' One more student welcome.',join+' We are two people.'),null);
 assert.equal(compare(invite,join.replace('08:00','15:00')),null);
 assert.equal(compare(invite,join.replace('campus sundial','Sai Kung pier')),null);
});
