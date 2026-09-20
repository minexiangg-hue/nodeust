import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'transport',createdAt:now.toISOString()});
const a='我一個人，想搵人9月20日06:00從科大去香港機場，搭4乘客座位的士分車費。我得一個背包。';
const b='Solo traveller seeking a shared four-passenger taxi from HKUST to Hong Kong airport on 20 September 2026 at 06:00. Happy to split fare.';
const compare=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('taxi capacity is not evidence that a passenger is driving',()=>{
 const i=parseMatchPost(p(a,'a')).intents.find(i=>i.kind==='transport');
 assert.equal(i.side,'share');assert.equal(i.capacity,4);assert.equal(i.party,1);assert.equal(i.seats,undefined);
 assert.equal(compare(a,b)?.confidence,'high');
 assert.equal(compare(a.replace('我一個人','我們四個人'),b),null);
 assert.equal(compare(a,b.replace('06:00','09:00')),null);
});
test('explicit hired-taxi sharing remains separate from a driver offering a lift',()=>{
 const driver='I am driving from HKUST to airport on 20 Sep 2026 at 06:00, two passenger seats free.';
 assert.equal(parseMatchPost(p(driver,'a')).intents.find(i=>i.kind==='transport').side,'driver');
 assert.equal(compare(driver,b),null);
});

test('refusing a taxi share cannot generate a shared trip',()=>{
 assert.notEqual(compare(a,b.replace('seeking a shared','not sharing a'))?.confidence,'high');
});


test('requested companions constrain taxi matching even when the vehicle has more seats',()=>{
 const host='我和朋友共2人，9月20日06:00香港站C出口出發去科大北巴士站，想找1人夾4座的士。';
 const guest='Solo passenger wants to split a four-passenger taxi from Hong Kong Station Exit C to HKUST north bus stop on 20 Sep 2026 at 06:00.';
 assert.equal(compare(host,guest)?.confidence,'high');
 assert.equal(compare(host,guest.replace('Solo passenger','We are two passengers')),null);
 assert.equal(compare(host,guest.replace('Exit C','Exit D')),null);
 assert.equal(compare(host,guest.replace('Hong Kong Station','Kowloon Station')),null);
});


test('one explicit taxi capacity can cover both parties without inventing a default',()=>{
 const host='We are two passengers seeking to share a taxi with exactly four passenger seats from HKUST to airport on 26 Sep 2026 at 07:00.';
 const guest='We are two passengers looking to share a taxi from HKUST to airport on 26 Sep 2026 at 07:00.';
 assert.equal(compare(host,guest)?.confidence,'high');
 assert.equal(compare(host,guest.replace('two passengers','three passengers')),null);
 assert.notEqual(compare(host.replace(' with exactly four passenger seats',''),guest)?.confidence,'high');
 assert.equal(compare(host,guest.replace('a taxi','a three-passenger taxi')),null);
});


test('passengers booking a taxi and explicitly seeking more passengers establish sharing without a title',()=>{
 const host='We are two passengers booking a taxi with exactly four passenger seats from HKUST to airport on 26 Sep 2026 at 07:00. Looking for up to two more.';
 const guest='We are two passengers looking to share a taxi from HKUST to airport on 26 Sep 2026 at 07:00.';
 assert.equal(compare(host,guest)?.confidence,'high');
 assert.notEqual(compare(host.replace('Looking for up to two more.','Not looking for up to two more.'),guest)?.confidence,'high');
 assert.notEqual(compare(host.replace('Looking for up to two more.',''),guest)?.confidence,'high');
 assert.equal(compare(host,guest.replace('two passengers','three passengers')),null);
});
