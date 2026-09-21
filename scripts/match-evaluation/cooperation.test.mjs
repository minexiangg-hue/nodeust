import test from 'node:test';
import assert from 'node:assert/strict';
import {requestsCooperation} from '../../lib/match/cooperation.ts';
test('cooperation recognises participation grammar independently of topic names',()=>{
 for(const s of ['Looking for classmates to work through thermodynamics together','想搵同學一齊溫天文學','Anyone solving topology exercises with me?'])assert.equal(requestsCooperation(s,'study'),true,s);
 assert.equal(requestsCooperation('Looking for a companion for pottery','activity'),true);
 assert.equal(requestsCooperation('Looking for a companion for pottery','study'),false);
});
test('diaries, absent roles, negated and quoted cooperation are not requests',()=>{
 for(const s of ['I study topology','Topology exercises','I am not looking for classmates to study','I used to want a study partner','Just quoting: looking for a study partner','唔想搵同學一齊溫書'])assert.equal(requestsCooperation(s,'study'),false,s);
});
