import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { judgeSemanticPair } from './semantic-pair-client.mjs';

const fixturePath = process.env.MATCH_HOLDOUT || 'scripts/match-evaluation/validation-v2.json';
const raw = readFileSync(fixturePath, 'utf8');
const fixture = JSON.parse(raw);
const cases = Array.isArray(fixture) ? fixture : fixture.cases;
const now = fixture.now || '2026-09-11T04:00:00Z';
const kinds = ['hall', 'goods', 'study', 'transport', 'other'];
const pilot = process.env.MATCH_SEMANTIC_PILOT === '1';
const stratified = process.env.MATCH_SEMANTIC_SAMPLE === 'stratified';
const selected = stratified
  ? kinds.flatMap(kind => ['match', 'reject', 'uncertain'].map(expected => cases.find(row => row.kind === kind && row.expected === expected))).filter(Boolean)
  : pilot ? kinds.map(kind => cases.find(row => row.kind === kind)).filter(Boolean) : cases;
const output = process.env.MATCH_EVAL_OUTPUT || 'reports/match-iteration-2026-09-11/iteration-06';
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/pair-judgments.jsonl`, '');
const started = performance.now();
const rows = [];
for (const item of selected) {
  const post = side => {
    const source = item[side];
    return {
      id: `${item.id}-${side}`, title: source.title, body: source.body,
      category: source.category, createdAt: source.createdAt,
      currentHall: source.currentHall, targetHall: source.targetHall,
      roomType: source.roomType, genderEligibility: source.genderEligibility, availableFrom: source.availableFrom,
    };
  };
  const result = await judgeSemanticPair(post('a'), post('b'), {
    now,
    endpoint: process.env.MATCH_SEMANTIC_ENDPOINT,
    cacheDirectory: 'reports/match-iteration-2026-09-11/artifacts/semantic-pair-cache',
  });
  const decision = result.validation?.ok ? result.validation.judgment.decision : 'invalid';
  const actualHigh = decision === 'compatible';
  const correct = item.expected === 'match' ? actualHigh : !actualHigh;
  const row = { id: item.id, kind: item.kind, expected: item.expected, decision, correct, result };
  rows.push(row);
  appendFileSync(`${output}/pair-judgments.jsonl`, `${JSON.stringify(row)}\n`);
  console.log(JSON.stringify({ pair: item.id, expected: item.expected, decision, correct,
    ms: Math.round(result.ms), cacheHit: result.cacheHit, tokens: result.usage?.completion_tokens }));
  const summary = {
    status: pilot || stratified ? 'development_pilot_not_acceptance_evidence' : 'development_evaluation',
    fixturePath, fixtureSha256: createHash('sha256').update(raw).digest('hex'),
    selection: stratified ? 'First match, reject and uncertain pair in each category, selected by order before inference' : pilot ? 'First pair in each category, selected by order before inference' : 'All fixture pairs',
    model: result.model, modelSha256: result.modelSha256,
    selectedCases: selected.length, evaluatedCases: rows.length, totalMs: performance.now() - started,
    byKind: Object.fromEntries(kinds.map(kind => {
      const group = rows.filter(row => row.kind === kind);
      const positives = group.filter(row => row.expected === 'match');
      const negatives = group.filter(row => row.expected !== 'match');
      const tp = positives.filter(row => row.decision === 'compatible').length;
      const fp = negatives.filter(row => row.decision === 'compatible').length;
      return [kind, { positives: positives.length, negatives: negatives.length, tp, fp,
        invalid: group.filter(row => row.decision === 'invalid').length,
        precision: tp + fp ? tp / (tp + fp) : null, recall: positives.length ? tp / positives.length : null }];
    })),
  };
  writeFileSync(`${output}/pair-summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
}
