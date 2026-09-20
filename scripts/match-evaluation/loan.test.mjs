import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts,MatchIndex,rankMatches} from '../../lib/match/engine.ts';
import {loanPeriod,compareLoanPeriods} from '../../lib/match/loan.ts';
const now=new Date('2026-09-11T04:00:00Z');
const post=(body,id='a')=>({id,ownerId:id,category:'other',title:'',body,createdAt:now.toISOString()});
const offer='I can lend my working calculator for HK$20. Pickup at library on 15 Sep 2026 at 10:00; return there on 16 Sep 2026 at 10:00.';
const seek='I want to borrow a working calculator, budget HK$30. Pickup at library on 15 Sep 2026 at 10:00; return there on 16 Sep 2026 at 10:00.';
const pair=(a,b)=>comparePosts(parseMatchPost(post(a)),parseMatchPost(post(b,'b')),now);
test('loan distinguishes pickup from return and matches through the real index',()=>{
 assert.deepEqual(loanPeriod(offer,post(offer)),{loanStart:'2026-09-15T10:00:00+08:00',loanEnd:'2026-09-16T10:00:00+08:00',loanPickupPlace:'hkust-library',loanReturnPlace:'hkust-library'});
 assert.equal(pair(offer,seek)?.confidence,'high');
 assert.deepEqual(pair(offer,seek),pair(seek,offer));
 const index=new MatchIndex([post(offer),post(seek,'b')]);
 const own=[index.posts.get('a')];const candidates=[...index.candidates(own)].map(id=>index.posts.get(id));
 assert.equal(rankMatches(own,candidates,now).filter(r=>r.confidence==='high').length,1);
});
test('loans reject purchases, late returns, unaffordable fees and broken equipment',()=>{
 for(const b of [seek.replace('borrow','buy'),seek.replace('16 Sep','17 Sep'),seek.replace('HK$30','HK$10')])assert.equal(pair(offer,b),null,b);
 assert.equal(pair(offer.replace('working','broken'),seek),null);
});
test('unknown return, deposit and daily rates cannot become high confidence',()=>{
 for(const a of [offer.replace('; return there on 16 Sep 2026 at 10:00.','.'),offer+' Deposit HK$200.',offer.replace('HK$20','HK$20 per day')])
 assert.notEqual(pair(a,seek)?.confidence,'high',a);
 assert.equal(compareLoanPeriods({loanStart:'invalid',loanEnd:'invalid'},{}),'unknown');
 assert.deepEqual(loanPeriod(offer.replace('16 Sep','14 Sep'),post(offer)),{});
});

test('borrowed tools preserve explicit voltage and do not become sales',()=>{
 const a=offer.replace('calculator','18V cordless drill');
 const b=seek.replace('calculator','18 V cordless drill');
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('18 V','12 V')),null);
 assert.notEqual(pair(a.replace('18V ',''),b)?.confidence,'high');
 assert.equal(pair(a,b.replace('borrow','buy')),null);
 const invalid={loanStart:'2026-02-30T10:00:00+08:00',loanEnd:'2026-03-04T10:00:00+08:00'};
 assert.equal(compareLoanPeriods(invalid,invalid),'unknown');
});


test('loans require explicit return location and reject incompatible return places',()=>{
 assert.notEqual(pair(offer.replace('return there','return'),seek)?.confidence,'high');
 assert.equal(pair(offer.replace('return there','return at north gate'),seek),null);
 assert.equal(pair(offer.replace('library','north bus stop'),seek),null);
});

test('cross-day Chinese intervals and an explicitly shared handover place retain both endpoints',()=>{
 const a='想借 calculator，9月22日11:00至9月23日11:00，圖書館門口取還，免費。';
 const b='Happy to lend my calculator free from 11:00 on 22 Sep 2026 until 11:00 on 23 Sep. Meet at the library entrance for both handovers.';
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a,b.replace('23 Sep','24 Sep')),null);
 assert.equal(pair(a,b.replace('library entrance','north gate')),null);
});
