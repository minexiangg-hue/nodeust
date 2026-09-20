import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
import {extractSchedule} from '../../lib/match/text.ts';
const now=new Date('2026-09-11T04:00:00Z');
const post=(body,id)=>({id,ownerId:id,title:'',body,category:'other',createdAt:now.toISOString()});
const host='9月18日18:00–19:00體育館4號場，已book好，搵2位初學者打羽毛球。只限新手，請自備球拍，英文或廣東話都得。';
const guest='I am one badminton beginner with my own racket, hoping to join a game at sports centre Court 4 on 18 Sep 2026, 18:00–19:00. I can chat in English.';
const compare=(a,b)=>comparePosts(parseMatchPost(post(a,'a')),parseMatchPost(post(b,'b')),now);
test('social host and participant preserve places, capacity, equipment and languages',()=>{
 assert.equal(compare(host,guest)?.confidence,'high');
 assert.equal(compare(host,guest.replace('Court 4','Court 5')),null);
 assert.equal(compare(host,guest.replace('one badminton','three badminton')),null);
 assert.equal(compare(host,guest.replace('English','Japanese')),null);
 assert.notEqual(compare(host,guest.replace('with my own racket,',''))?.confidence,'high');
 assert.notEqual(compare(host,guest.replace('beginner','player'))?.confidence,'high');
});
test('court and room numbers do not become calendar days',()=>{
 for(const suffix of ['4號場','4号篮球场','4号房','场4号']){
  const p=post(`9月18日18:00–19:00 ${suffix}`,'a');
  const s=extractSchedule(p);assert.equal(s.date,'2026-09-18');assert.equal(s.ambiguous,false,suffix);
 }
});

test('a joiner must cover the stated activity and cannot negate equipment or participation',()=>{
 assert.equal(compare(host,guest.replace('18:00–19:00','18:30–19:00')),null);
 assert.equal(compare(host,guest.replace('18:00–19:00','18:00–18:30')),null);
 assert.notEqual(compare(host,guest.replace('18:00–19:00','18:00'))?.confidence,'high');
 assert.notEqual(compare(host,guest.replace('with my own racket','without my own racket'))?.confidence,'high');
 assert.equal(compare(host,guest.replace('hoping to join','do not want to join')),null);
});

test('numbered outdoor basketball courts align across languages without merging venues',()=>{
 const a='Five of us have outdoor basketball Court 2 on 20 Sep 2026 from 17:00 to 18:00. One more student welcome; English or Cantonese.';
 const b='想加入9月20日17:00–18:00室外2號籃球場，我一個人，英文廣東話都ok。';
 assert.equal(compare(a,b)?.confidence,'high');
 assert.equal(compare(a,b.replace('2號','3號')),null);
 assert.equal(compare(a,b.replace('室外','室內')),null);
 assert.notEqual(compare(a+' Maybe Court 3 instead.',b)?.confidence,'high');
});

test('empty parties and zero remaining places do not generate activity matches',()=>{
 assert.equal(compare(host,guest.replace('one badminton','zero badminton')),null);
 assert.equal(compare(host.replace('搵2位','搵0位'),guest),null);
});


test('borrowing requires explicit provision, not merely another player owning a racket',()=>{
 const borrower=guest.replace('with my own racket','and need to borrow a racket');
 const provider=host.replace('請自備球拍','提供球拍');
 assert.equal(compare(provider,borrower)?.confidence,'high');
 assert.notEqual(compare(host.replace('請自備球拍','我有球拍'),borrower)?.confidence,'high');
 assert.notEqual(compare(host.replace('請自備球拍','不提供球拍'),borrower)?.confidence,'high');
 assert.notEqual(compare(host.replace('請自備球拍','Rackets are not provided'),borrower)?.confidence,'high');
 assert.equal(compare(host.replace('請自備球拍','Rackets provided'),borrower)?.confidence,'high');
});


test('participation restrictions require explicit compatible self descriptions',()=>{
 const limited=host+' Female students only.';
 const eligible=guest+' I am a female student.';
 assert.equal(compare(limited,eligible)?.confidence,'high');
 assert.equal(compare(limited,guest+' I am a male student.'),null);
 assert.notEqual(compare(limited,guest)?.confidence,'high');
 assert.notEqual(compare(limited,guest+' I am not a female student.')?.confidence,'high');
 assert.notEqual(compare(limited,guest+' My friend is a female student.')?.confidence,'high');
});


test('numbered table tennis venues, lending and participation eligibility work together',()=>{
 const a='Inviting one more female student beginner for table tennis, sports centre Table 4 on 26 Sep 2026 from 11:00 to 12:00. Rackets provided, Cantonese chat.';
 const b='女同學一個，乒乓球初學，想加入9月26日11:00–12:00體育館4號枱的練習。我講廣東話，需要借球拍。';
 assert.equal(compare(a,b)?.confidence,'high');
 assert.equal(compare(a,b.replace('4號枱','5號枱')),null);
 assert.equal(compare(a,b.replace('女同學','男同學')),null);
 assert.notEqual(compare(a.replace('Rackets provided','Rackets are not provided'),b)?.confidence,'high');
});


test('a neutral title does not obscure a body-leading self description',()=>{
 const a=parseMatchPost(post(host+' Female students only.','a'));
 const b=parseMatchPost({...post('女同學一個。'+guest,'b'),title:'Looking for a game'});
 assert.equal(comparePosts(a,b,now)?.confidence,'high');
});


test('campus title does not add a conflicting prefix to a numbered outdoor court',()=>{
 const body='Five of us have outdoor basketball Court 2 on 26 Sep 2026 from 17:00 to 18:00. One more student welcome; English.';
 const ordinary=parseMatchPost(post(body,'a')).intents.find(i=>i.kind==='other');
 const generic=parseMatchPost({...post(body,'a'),title:'Campus request'}).intents.find(i=>i.kind==='other');
 assert.equal(generic?.place,ordinary?.place);
});
