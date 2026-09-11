import test from 'node:test';
import assert from 'node:assert/strict';
import { LEDGER_CHECKS, semanticEvidenceSources, validateSemanticLedger } from './semantic-ledger.mjs';
import { resolveSemanticReferences } from './semantic-client.mjs';
import { buildSemanticPairRequest } from './semantic-pair-client.mjs';
const now = '2026-09-11T04:00:00Z';
const a = { category: 'goods', title: 'Lamp', body: 'Offering my lamp.', createdAt: now };
const b = { category: 'other', title: 'Reading light', body: 'Looking for a lamp.', createdAt: now };
const ledger = () => Object.fromEntries(LEDGER_CHECKS.map(name => [name, { aEvidence: [a.body], bEvidence: [b.body], result: 'pass' }]));
const validate = value => validateSemanticLedger(a, b, JSON.stringify(value));

test('all checks contribute to the decision; an unknown condition cannot become high', () => {
  assert.equal(validate(ledger()).judgment.decision, 'compatible');
  for (const name of LEDGER_CHECKS) {
    const value = ledger(); value[name].result = 'unknown';
    assert.equal(validate(value).judgment.decision, 'insufficient');
    value[name].result = 'conflict';
    assert.equal(validate(value).judgment.decision, 'conflict');
  }
  const value = ledger(); value.intent.result = 'unknown'; value.resource.result = 'conflict';
  assert.equal(validate(value).judgment.decision, 'conflict');
});
test('missing checks, unsupported passes, invented quotes and overall decisions are invalid', () => {
  for (const mutate of [v => { delete v.resource; }, v => { v.decision = 'compatible'; }, v => { v.availability.result = 'irrelevant'; }, v => { v.intent.aEvidence = []; }, v => { v.resource.bEvidence = ['invented']; }, v => { v.arrangement.aEvidence = [b.body]; }, v => { v.intent.result = 'maybe'; }]) {
    const value = ledger(); mutate(value); assert.equal(validate(value).ok, false);
  }
  const value = ledger(); value.otherRequirements = {aEvidence: [], bEvidence: [], result: 'irrelevant'};
  assert.equal(validate(value).ok, true);
});
test('ledger is an explicit experiment with its own request and cache identity', () => {
  const direct = buildSemanticPairRequest(a, b, {now});
  const built = buildSemanticPairRequest(a, b, {now, protocol:'ledger', enableThinking:false});
  assert.equal(built.protocol, 'ledger');
  assert.equal(built.request.max_tokens, 1600);
  assert.deepEqual(Object.keys(built.request.response_format.json_schema.schema.properties), LEDGER_CHECKS);
  assert.notEqual(built.key, direct.key);
  assert.notEqual(built.promptSha256, direct.promptSha256);
  assert.notEqual(built.schemaSha256, direct.schemaSha256);
});


test('sentence references resolve to exact public text without copying model paraphrases', () => {
  const post = {...a, body:'Asking HKD 10.50. Pickup tomorrow! 不接受郵寄。', ownerId:'private-owner', email:'private-email'};
  const sources = semanticEvidenceSources(post);
  assert.ok(sources.some(source => source.text === 'Asking HKD 10.50.'));
  assert.ok(sources.some(source => source.text === '不接受郵寄。'));
  const built = buildSemanticPairRequest(post, b, {now, protocol:'ledger-refs'});
  assert.ok(!JSON.stringify(built.request).includes('private-'));
  const value = ledger();
  for (const check of Object.values(value)) { check.aEvidence = [1]; check.bEvidence = [1]; }
  const result = validateSemanticLedger(post, b, JSON.stringify(value), true);
  assert.equal(result.ok, true);
  assert.deepEqual(result.judgment.evidenceSources.a, sources);
  value.resource.bEvidence = [999];
  assert.equal(validateSemanticLedger(post, b, JSON.stringify(value), true).ok, false);
  value.resource.bEvidence = ['1'];
  assert.equal(validateSemanticLedger(post, b, JSON.stringify(value), true).ok, false);
});


test('single-post extraction references preserve facts and reject invented or string indices', () => {
  const raw = JSON.stringify({intents:[{kind:'goods',side:'offer',entity:'lamp',evidence:[1]}]});
  const resolved = resolveSemanticReferences(a,raw);
  assert.equal(resolved.ok,true);
  assert.deepEqual(JSON.parse(resolved.output).intents[0].evidence,[a.body]);
  for (const evidence of [[99],['1'],[-1],[0.5]])
    assert.equal(resolveSemanticReferences(a,JSON.stringify({intents:[{evidence}]})).ok,false);
});


test('extra conditions also resolve from bounded exact segments instead of model translations', () => {
  const post={...a,body:'Bring your own bag. '+('Please keep this lamp dry and return it safely. '.repeat(6))};
  const sources=semanticEvidenceSources(post);
  assert.ok(sources.every(source=>source.text.length<=140));
  for(const source of sources) assert.ok(post.title.includes(source.text)||post.body.includes(source.text));
  const raw=JSON.stringify({intents:[{kind:'goods',side:'offer',entity:'lamp',evidence:[1],otherRequirements:[1]}]});
  const resolved=resolveSemanticReferences(post,raw);
  assert.equal(resolved.ok,true);
  assert.deepEqual(JSON.parse(resolved.output).intents[0].otherRequirements,[sources[1].text]);
  assert.equal(resolveSemanticReferences(post,JSON.stringify({intents:[{evidence:[1],otherRequirements:['bring bag']}]})).ok,false);
});
