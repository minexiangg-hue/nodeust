import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMatchPost,comparePosts} from '../../lib/match/engine.ts';
const now=new Date('2026-09-11T04:00:00Z');
const p=(body,id)=>({id,ownerId:id,title:'',body,category:'transport',createdAt:now.toISOString()});
const a='9月26日18:30開車從科大去沙田，3個乘客位，可放3個小背包。免費搭順風車。';
const b='We are three people, each with one small backpack, seeking a free lift from HKUST to Sha Tin on 26 Sep 2026 at 18:30.';
const pair=(x,y)=>comparePosts(parseMatchPost(p(x,'a')),parseMatchPost(p(y,'b')),now);
test('seat and total backpack capacities cover all participants',()=>{
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a.replace('可放3','可放2'),b),null);
 assert.equal(pair(a.replace('3個乘客位','2個乘客位'),b),null);
 assert.notEqual(pair(a,b.replace('one small backpack','one suitcase'))?.confidence,'high');
});
test('unparsed fare and baggage restrictions cannot disappear',()=>{
 assert.notEqual(pair(a.replace('免費搭順風車','HK$50 per passenger'),b)?.confidence,'high');
 assert.equal(pair(a.replace('可放3個小背包','backpacks only'),b)?.confidence,'high');
});


test('per-person fares and backpack-only policy match bilingual riders on the same station route',()=>{
 const driver='I am driving from HKUST north bus stop to Kowloon Station on 26 Sep 2026 at 09:00. Two passenger seats free, HK$30 per passenger, backpacks only.';
 const rider='我同朋友共2人，想搵順風車，9月26日09:00從科大北巴士站去九龍站，每人最多HK$40，兩人各一個背包。';
 assert.equal(pair(driver,rider)?.confidence,'high');
 assert.equal(pair(driver,rider.replace('HK$40','HK$20')),null);
 assert.notEqual(pair(driver,rider.replace('每人最多','总共最多'))?.confidence,'high');
 assert.equal(pair(driver,rider.replace('九龍站','沙田')),null);
});

test('carried backpacks are not purchase requests, while separate buying intent remains',()=>{
 const ride='我同朋友共2人，想搵順風車，9月26日09:00從科大北巴士站去九龍站，每人最多HK$40，兩人各一個背包。';
 const items=parseMatchPost(p(ride,'a')).intents;
 assert.equal(items.some(i=>i.kind==='goods'),false);
 assert.ok(items.some(i=>i.kind==='transport'));
 const combined=parseMatchPost(p(ride+' 另外想买 backpack，预算HKD100。','a')).intents;
 assert.ok(combined.some(i=>i.kind==='goods'&&i.entity==='backpack'&&i.side==='seek'));
});

test('an explicit sale title survives a travel detail in the item description',()=>{
 const parsed=parseMatchPost({...p('Backpack HKD90. You can take a taxi to collect it.','a'),title:'Selling backpack'});
 assert.ok(parsed.intents.some(i=>i.kind==='goods'&&i.side==='offer'));
});


test('explicit small-bag capacity supports third-person ride requests without assuming generic bags are small',()=>{
 const driver='9月26日18:30開車從科大去沙田，有1個乘客位，免費；只可帶一個小袋。';
 const rider='One person needs a free lift from HKUST to Sha Tin on 26 Sep 2026 at 18:30. Carrying only a small handbag.';
 assert.equal(pair(driver,rider)?.confidence,'high');
 assert.equal(pair(driver,rider.replace('a small handbag','two small handbags')),null);
 assert.notEqual(pair(driver,rider.replace('a small handbag','a handbag'))?.confidence,'high');
 assert.notEqual(pair(driver,rider.replace('a small handbag','a suitcase'))?.confidence,'high');
 assert.notEqual(pair(driver,rider.replace('a small handbag','a small handbag and a suitcase'))?.confidence,'high');
});


test('per-passenger baggage limits do not become total limits or guessed averages',()=>{
 const driver=a.replace('可放3個小背包','接受每人一個背包');
 assert.equal(pair(driver,b)?.confidence,'high');
 assert.equal(pair(driver,b.replace('one small backpack','two small backpacks')),null);
 assert.notEqual(pair(driver,b.replace('each with one small backpack','with three small backpacks in total'))?.confidence,'high');
 assert.equal(pair(a,b)?.confidence,'high');
 assert.equal(pair(a.replace('可放3','可放2'),b),null);
});

test('per-person and vehicle-wide baggage limits both apply',()=>{
 const driver=a.replace('可放3個小背包','接受每人一個背包，可放2個小背包');
 assert.equal(pair(driver,b),null);
 assert.equal(pair(driver.replace('可放2','可放3'),b)?.confidence,'high');
 assert.equal(pair(driver.replace('可放2','可放6'),b.replace('one small backpack','two small backpacks')),null);
});
