import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStudy} from '../../lib/match/mobility-study.ts';
const p=(body,title='')=>({id:'scope',title,body,category:'study',createdAt:'2026-09-11T04:00:00Z'});
test('a single course retains trailing time and location after a semicolon',()=>{
 const items=parseStudy(p('想搵同級同學互相對下積分練習思路，廣東話；9月25日19:00–20:00我在圖書館地下，一齊練習可以。','MATH1014 buddy'));
 assert.equal(items.length,1);assert.equal(items[0].entity,'MATH1014');
 assert.equal(items[0].date,'2026-09-25');assert.equal(items[0].minute,1140);assert.equal(items[0].communication,'cantonese');assert.equal(items[0].place,'library');
});
test('closing one course does not close a separately stated still-active request',()=>{
 const items=parseStudy(p('No longer need help with ACCT2010. Still need a tutor for ECON2103 in English, library on 25 Sep 2026 at 14:00.'));
 assert.deepEqual(items.map(i=>i.entity),['ECON2103']);
});
test('different explicit courses cannot inherit one another’s schedule or role',()=>{
 const items=parseStudy(p('Need a tutor for COMP2011 in English; 9月25日19:00我可以教MATH1013，普通話，圖書館。'));
 const comp=items.find(i=>i.entity==='COMP2011');
 assert.equal(comp.date,undefined);assert.equal(comp.side,'seek');
});

test('a separate ride cannot lend its departure time to an undated course',()=>{
 const items=parseStudy(p('Need a tutor for COMP2011 in English; 9月25日19:00 need a ride from HKUST to airport for 1 person.'));
 assert.equal(items.find(i=>i.entity==='COMP2011').date,undefined);
});
