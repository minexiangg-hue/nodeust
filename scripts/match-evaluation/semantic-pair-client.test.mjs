import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildSemanticPairRequest, judgeSemanticPair, SEMANTIC_PAIR_SCHEMA,
  semanticPairPublicInput, validateSemanticPairResponse,
  SEMANTIC_PAIR_PROMPT_SHA256, SEMANTIC_PAIR_SCHEMA_SHA256,
} from './semantic-pair-client.mjs';
import { buildSemanticOrderProbePlan } from './semantic-order-probe.mjs';

const now = '2026-09-11T04:00:00Z';
const a = { id: 'private-fixture-a', ownerId: 'private-owner-a', category: 'other', title: 'Desk available', body: 'Offering my desk. Collection time undecided.', createdAt: now };
const b = { id: 'private-fixture-b', ownerId: 'private-owner-b', category: 'goods', title: 'Desk wanted', body: 'Looking for a desk, pickup details still to discuss.', createdAt: now };
const valid = { decision: 'insufficient', reason: 'The handover arrangement has not been stated.', evidenceA: ['Collection time undecided.'], evidenceB: ['pickup details still to discuss.'] };

test('public pair input excludes fixture labels, IDs, owners and private metadata', () => {
  const extra = { email: 'private-email-marker', contactValue: 'private-contact-marker', expected: 'private-label-marker', reason: 'private-rationale-marker', locationId: 'private-tag-marker' };
  const input = semanticPairPublicInput({ ...a, ...extra }, b, now);
  const built = buildSemanticPairRequest({ ...a, ...extra }, b, { now });
  assert.equal(input.asOf, now.replace('Z', '.000Z'));
  assert.deepEqual(JSON.parse(built.request.messages[1].content), { untrustedPairData: input });
  assert.ok(!JSON.stringify(built.request).includes('private-'));
  assert.deepEqual(Object.keys(SEMANTIC_PAIR_SCHEMA.properties), ['decision', 'reason', 'evidenceA', 'evidenceB']);
});

test('localhost guard rejects remote URLs, credentials, query secrets and fragments before any request', () => {
  for (const endpoint of ['https://127.0.0.1:8092/v1/chat/completions', 'http://example.invalid/v1/chat/completions', 'http://127.0.0.1.example.invalid/', 'http://user:password@localhost/', 'http://localhost/?token=marker', 'http://localhost/#fragment'])
    assert.throws(() => buildSemanticPairRequest(a, b, { now, endpoint }), /localhost/);
  for (const endpoint of ['http://localhost:8092/v1/chat/completions', 'http://[::1]:8092/v1/chat/completions'])
    assert.equal(buildSemanticPairRequest(a, b, { now, endpoint }).endpoint, endpoint);
});

test('cache keys bind ordered public inputs, evaluation time, model identity and generation settings', () => {
  const build = (left = a, right = b, extra = {}) => buildSemanticPairRequest(left, right, { now, ...extra });
  const baseline = build();
  assert.equal(build({ ...a, id: 'another-private-id', ownerId: 'another-owner', expected: 'match' }).key, baseline.key);
  for (const changed of [build({ ...a, body: `${a.body} Revised.` }), build(b, a), build(a, b, { now: '2026-09-12T04:00:00Z' }), build(a, b, { modelSha256: 'f'.repeat(64) }), build(a, b, { model: 'another-local-model' }), build(a, b, { maxTokens: 400 })])
    assert.notEqual(changed.key, baseline.key);
  assert.match(baseline.promptSha256, /^[a-f0-9]{64}$/);
  assert.match(baseline.schemaSha256, /^[a-f0-9]{64}$/);
});

test('valid output preserves exact evidence and explicit structured-field quotations', () => {
  assert.deepEqual(validateSemanticPairResponse(a, b, JSON.stringify(valid)), { ok: true, judgment: valid });
  assert.equal(validateSemanticPairResponse({ ...a, currentHall: 'UG Hall I' }, b, { ...valid, evidenceA: ['UG Hall I'] }).ok, true);
  assert.equal(validateSemanticPairResponse(a, b, { ...valid, decision: 'compatible' }).ok, true);
  // This deliberately does not prove compatibility: the validator checks grounding, not labels.
});

test('invented, paraphrased, swapped, metadata and cross-field concatenated evidence is rejected', () => {
  for (const quote of ['Collection tomorrow.', 'collection time undecided.', b.body, a.id, a.createdAt, `${a.title}${a.body}`])
    assert.ok(validateSemanticPairResponse(a, b, { ...valid, evidenceA: [quote] }).errors.includes('unverified-evidence:evidenceA'));
  assert.ok(validateSemanticPairResponse(a, b, { ...valid, evidenceB: [a.body] }).errors.includes('unverified-evidence:evidenceB'));
});

test('malformed output, free-form confidence, missing sides and unbounded evidence fail closed', () => {
  for (const value of ['not JSON', '```json\n{}\n```', ' '.repeat(8193), null, [], { ...valid, confidence: 0.99 }, { ...valid, decision: 'match' }, { ...valid, evidenceB: [] }, { ...valid, evidenceA: Array(3).fill(a.body) }, { ...valid, evidenceA: [a.body, a.body] }, { ...valid, reason: 'x'.repeat(321) }, { ...valid, evidenceA: [42] }, { ...valid, evidenceB: [' '] }])
    assert.equal(validateSemanticPairResponse(a, b, value).ok, false);
  assert.equal(validateSemanticPairResponse(a, b, JSON.parse('{"__proto__":{},"decision":"insufficient","reason":"Unknown","evidenceA":["desk"],"evidenceB":["desk"]}')).ok, false);
});

test('cached outputs are revalidated and logged without calling any model', async t => {
  const fetchGuard = t.mock.method(globalThis, 'fetch', () => { throw new Error('Validator tests must never call a model'); });
  const directory = await mkdtemp(join(tmpdir(), 'nodeust-pair-validator-'));
  try {
    const { request, timeoutMs, ...metadata } = buildSemanticPairRequest(a, b, { now });
    assert.ok(request && timeoutMs);
    const record = { ...metadata, output: JSON.stringify(valid), finishReason: 'stop', usage: { completion_tokens: 30 }, ms: 42 };
    const path = join(directory, `${metadata.key}.json`);
    const logPath = join(directory, 'results.jsonl');
    await writeFile(path, JSON.stringify(record));
    const result = await judgeSemanticPair(a, b, { now, cacheDirectory: directory, logPath });
    assert.equal(result.cacheHit, true);
    assert.equal(result.validation.ok, true);
    assert.equal(JSON.parse((await readFile(logPath, 'utf8')).trim()).output, record.output);
    await writeFile(path, JSON.stringify({ ...record, output: JSON.stringify({ ...valid, evidenceB: ['invented quote'] }) }));
    assert.equal((await judgeSemanticPair(a, b, { now, cacheDirectory: directory })).validation.ok, false);
    await writeFile(path, JSON.stringify({ ...record, finishReason: 'length' }));
    assert.deepEqual((await judgeSemanticPair(a, b, { now, cacheDirectory: directory })).validation, { ok: false, errors: ['incomplete-generation:length'] });
    await writeFile(path, JSON.stringify({ ...record, modelSha256: '0'.repeat(64) }));
    await assert.rejects(judgeSemanticPair(a, b, { now, cacheDirectory: directory }), /Mismatched/);
    assert.equal(fetchGuard.mock.callCount(), 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('default decision-first request retains the frozen prompt and schema exactly', () => {
  const implicit = buildSemanticPairRequest(a, b, { now });
  const explicit = buildSemanticPairRequest(a, b, { now, outputOrder: 'decision-first' });
  assert.deepEqual(implicit, explicit);
  assert.equal(implicit.outputOrder, 'decision-first');
  assert.equal(SEMANTIC_PAIR_PROMPT_SHA256, 'b625e9fefd6ef1073b211b5334860d7b93d9042313a8ceb9df459f9eba12fc0b');
  assert.equal(SEMANTIC_PAIR_SCHEMA_SHA256, 'ffe598ef3e91cac357658fc698e794a5170356d8bb921a3e53d8b23d37a67f45');
  assert.equal(implicit.promptSha256, SEMANTIC_PAIR_PROMPT_SHA256);
  assert.equal(implicit.schemaSha256, SEMANTIC_PAIR_SCHEMA_SHA256);
});

test('evidence-first changes only output ordering and hashes the actual request contract', () => {
  const baseline = buildSemanticPairRequest(a, b, { now });
  const experiment = buildSemanticPairRequest(a, b, { now, outputOrder: 'evidence-first' });
  const schema = experiment.request.response_format.json_schema.schema;
  const fields = ['evidenceA', 'evidenceB', 'reason', 'decision'];
  assert.deepEqual(Object.keys(schema.properties), fields);
  assert.deepEqual(schema.required, fields);
  for (const field of fields) assert.deepEqual(schema.properties[field], SEMANTIC_PAIR_SCHEMA.properties[field]);
  assert.equal(schema.type, SEMANTIC_PAIR_SCHEMA.type);
  assert.equal(schema.additionalProperties, SEMANTIC_PAIR_SCHEMA.additionalProperties);
  const defaultLines = baseline.request.messages[0].content.split('\n');
  const changedLines = experiment.request.messages[0].content.split('\n');
  assert.equal(defaultLines.length, changedLines.length);
  for (let i = 0; i < defaultLines.length; i++) {
    if (i === 1) assert.notEqual(defaultLines[i], changedLines[i]);
    else assert.equal(defaultLines[i], changedLines[i]);
  }
  const { messages: defaultMessages, response_format: defaultFormat, ...defaultSettings } = baseline.request;
  const { messages: changedMessages, response_format: changedFormat, ...changedSettings } = experiment.request;
  assert.ok(defaultFormat && changedFormat);
  assert.deepEqual(defaultSettings, changedSettings);
  assert.equal(defaultMessages[1].content, changedMessages[1].content);
  assert.equal(experiment.outputOrder, 'evidence-first');
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(experiment.promptSha256, hash(changedMessages[0].content));
  assert.equal(experiment.schemaSha256, hash(JSON.stringify(schema)));
  assert.notEqual(experiment.promptSha256, baseline.promptSha256);
  assert.notEqual(experiment.schemaSha256, baseline.schemaSha256);
  assert.notEqual(experiment.key, baseline.key);
  const reordered = { evidenceA: valid.evidenceA, evidenceB: valid.evidenceB, reason: valid.reason, decision: valid.decision };
  assert.deepEqual(validateSemanticPairResponse(a, b, JSON.stringify(reordered)), { ok: true, judgment: valid });
  assert.equal(validateSemanticPairResponse(a, b, { ...reordered, evidenceA: ['invented evidence'] }).ok, false);
  for (const outputOrder of ['reason-first', '', 1]) assert.throws(() => buildSemanticPairRequest(a, b, { now, outputOrder }), /output order/);
});

test('mode-specific caches remain isolated and reject forged order or default hash provenance', async t => {
  const fetchGuard = t.mock.method(globalThis, 'fetch', () => { throw new Error('Order tests must never call a model'); });
  const directory = await mkdtemp(join(tmpdir(), 'nodeust-pair-order-'));
  try {
    const records = {};
    for (const outputOrder of ['decision-first', 'evidence-first']) {
      const { request, timeoutMs, ...metadata } = buildSemanticPairRequest(a, b, { now, outputOrder });
      assert.ok(request && timeoutMs);
      records[outputOrder] = { ...metadata, output: JSON.stringify(valid), finishReason: 'stop', ms: outputOrder === 'decision-first' ? 40 : 41, usage: { completion_tokens: 30 } };
      await writeFile(join(directory, `${metadata.key}.json`), JSON.stringify(records[outputOrder]));
    }
    for (const outputOrder of ['decision-first', 'evidence-first']) {
      const result = await judgeSemanticPair(a, b, { now, outputOrder, cacheDirectory: directory });
      assert.equal(result.cacheHit, true);
      assert.equal(result.outputOrder, outputOrder);
      assert.equal(result.ms, records[outputOrder].ms);
      assert.equal(result.validation.ok, true);
    }
    const experimental = records['evidence-first'];
    const path = join(directory, `${experimental.key}.json`);
    for (const changed of [{ outputOrder: 'decision-first' }, { promptSha256: SEMANTIC_PAIR_PROMPT_SHA256 }, { schemaSha256: SEMANTIC_PAIR_SCHEMA_SHA256 }]) {
      await writeFile(path, JSON.stringify({ ...experimental, ...changed }));
      await assert.rejects(judgeSemanticPair(a, b, { now, outputOrder: 'evidence-first', cacheDirectory: directory }), /Mismatched/);
    }
    assert.equal(fetchGuard.mock.callCount(), 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('order probe fixes the first hall match and uncertain cases without leaking selection labels', t => {
  const fetchGuard = t.mock.method(globalThis, 'fetch', () => { throw new Error('Probe planning must not call a model'); });
  const item = (id, kind, expected) => ({ id, kind, expected, reason: 'private-evaluator-rationale',
    a: { ...a, expected: 'private-label-a', reason: 'private-post-rationale' }, b: { ...b, expected: 'private-label-b' } });
  const fixture = { now, cases: [item('private-goods', 'goods', 'match'), item('private-first-match', 'hall', 'match'),
    item('private-later-match', 'hall', 'match'), item('private-first-uncertain', 'hall', 'uncertain'), item('private-later-uncertain', 'hall', 'uncertain')] };
  const plan = buildSemanticOrderProbePlan(fixture, { model: 'same-local-model', modelSha256: 'a'.repeat(64), maxTokens: 500, timeoutMs: 30000 });
  assert.equal(plan.entries.length, 4);
  assert.deepEqual(plan.entries.map(entry => entry.pairId), ['private-first-match', 'private-first-match', 'private-first-uncertain', 'private-first-uncertain']);
  assert.deepEqual(plan.entries.map(entry => entry.outputOrder), ['decision-first', 'evidence-first', 'decision-first', 'evidence-first']);
  for (const entry of plan.entries) {
    assert.equal(entry.built.request.model, 'same-local-model');
    assert.equal(entry.built.request.max_tokens, 500);
    assert.equal(entry.built.timeoutMs, 30000);
    assert.equal(entry.built.modelSha256, 'a'.repeat(64));
    assert.equal(entry.built.publicInput.asOf, now.replace('Z', '.000Z'));
    assert.ok(!JSON.stringify(entry.built.request).includes('private-'));
  }
  for (let i = 0; i < plan.entries.length; i += 2) {
    const first = plan.entries[i].built.request, second = plan.entries[i + 1].built.request;
    assert.equal(first.messages[1].content, second.messages[1].content);
    assert.equal(first.temperature, second.temperature);
    assert.equal(first.seed, second.seed);
    assert.equal(first.cache_prompt, second.cache_prompt);
  }
  assert.throws(() => buildSemanticOrderProbePlan({ now, cases: [] }), /Missing first hall match/);
  assert.equal(fetchGuard.mock.callCount(), 0);
});
