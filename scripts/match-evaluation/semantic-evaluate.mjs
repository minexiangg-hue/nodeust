import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { extractSemanticPost, SEMANTIC_MODEL, SEMANTIC_MODEL_SHA256 } from './semantic-client.mjs';
import { comparePosts } from '../../lib/match/engine.ts';

const fixturePath = process.env.MATCH_HOLDOUT || 'scripts/match-evaluation/validation-v2.json';
const raw = readFileSync(fixturePath, 'utf8');
const fixture = JSON.parse(raw);
const cases = Array.isArray(fixture) ? fixture : fixture.cases;
const now = new Date(fixture.now || '2026-09-11T04:00:00Z');
const kinds = ['hall', 'goods', 'study', 'transport', 'other'];
const pilot = process.env.MATCH_SEMANTIC_PILOT === '1';
const selected = pilot ? kinds.map(kind => cases.find(row => row.kind === kind)).filter(Boolean) : cases;
const output = process.env.MATCH_EVAL_OUTPUT || 'reports/match-iteration-2026-09-11/iteration-04';
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/semantic-posts.jsonl`, '');
writeFileSync(`${output}/semantic-pairs.jsonl`, '');
const started = performance.now();
const rows = [];
let extractionCalls = 0, cacheHits = 0, invalid = 0;
for (const item of selected) {
  const parsed = [];
  const extractions = [];
  for (const side of ['a', 'b']) {
    // Explicit allowlist: fixture IDs, labels and explanations never enter model input.
    const source = item[side];
    const post = {
      id: `${item.id}-${side}`, ownerId: side, status: 'active',
      title: source.title, body: source.body, category: source.category, createdAt: source.createdAt,
      currentHall: source.currentHall, targetHall: source.targetHall,
      roomType: source.roomType, genderEligibility: source.genderEligibility, availableFrom: source.availableFrom,
    };
    const result = await extractSemanticPost(post, {
      endpoint: process.env.MATCH_SEMANTIC_ENDPOINT,
      cacheDirectory: 'reports/match-iteration-2026-09-11/artifacts/semantic-cache',
    });
    extractionCalls++;
    cacheHits += Number(result.cacheHit);
    invalid += Number(!result.validation.ok);
    appendFileSync(`${output}/semantic-posts.jsonl`, `${JSON.stringify({ id: post.id, ...result })}\n`);
    parsed.push(result.validation.ok ? result.validation.parsed : { post, intents: [], warnings: result.validation.errors });
    extractions.push({ ok: result.validation.ok, ms: result.ms, cacheHit: result.cacheHit });
    console.log(JSON.stringify({ post: post.id, ok: result.validation.ok, ms: Math.round(result.ms), cacheHit: result.cacheHit,
      tokens: result.usage?.completion_tokens, errors: result.validation.ok ? undefined : result.validation.errors }));
  }
  const predicted = comparePosts(parsed[0], parsed[1], now);
  const actualHigh = predicted?.confidence === 'high';
  const correct = item.expected === 'match' ? actualHigh : !actualHigh;
  const row = { id: item.id, kind: item.kind, expected: item.expected, predicted, correct, extractions };
  rows.push(row);
  appendFileSync(`${output}/semantic-pairs.jsonl`, `${JSON.stringify(row)}\n`);
  console.log(JSON.stringify({ pair: item.id, expected: item.expected, predicted: predicted?.confidence || 'none', correct }));
  const summary = {
    status: pilot ? 'development_pilot_not_acceptance_evidence' : 'development_evaluation',
    model: SEMANTIC_MODEL, modelSha256: SEMANTIC_MODEL_SHA256,
    fixturePath, fixtureSha256: createHash('sha256').update(raw).digest('hex'),
    selection: pilot ? 'First pair in each category, selected by order before inference' : 'All fixture pairs',
    selectedCases: selected.length, evaluatedCases: rows.length, extractionCalls, cacheHits, invalid,
    totalMs: performance.now() - started,
    byKind: Object.fromEntries(kinds.map(kind => {
      const group = rows.filter(row => row.kind === kind);
      const positives = group.filter(row => row.expected === 'match');
      const negatives = group.filter(row => row.expected !== 'match');
      const tp = positives.filter(row => row.predicted?.confidence === 'high').length;
      const fp = negatives.filter(row => row.predicted?.confidence === 'high').length;
      return [kind, { positives: positives.length, negatives: negatives.length, tp, fp, precision: tp + fp ? tp / (tp + fp) : null, recall: positives.length ? tp / positives.length : null }];
    })),
  };
  writeFileSync(`${output}/semantic-summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
}
