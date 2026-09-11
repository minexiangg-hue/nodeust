import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { buildSemanticPairRequest, judgeSemanticPair } from './semantic-pair-client.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const fixturePath = 'scripts/match-evaluation/validation-v2.json';
const orders = ['decision-first', 'evidence-first'];
const publicPost = source => ({
  title: source.title, body: source.body, category: source.category, createdAt: source.createdAt,
  currentHall: source.currentHall, targetHall: source.targetHall, roomType: source.roomType,
  genderEligibility: source.genderEligibility, availableFrom: source.availableFrom,
});

/** Pure planning: selection labels never become fields of either model input. */
export function buildSemanticOrderProbePlan(fixture, options = {}) {
  if (!Array.isArray(fixture?.cases) || !fixture.now) throw new TypeError('A dated case fixture is required');
  const selected = ['match', 'uncertain'].map(expected => {
    const item = fixture.cases.find(row => row.kind === 'hall' && row.expected === expected);
    if (!item) throw new Error(`Missing first hall ${expected} case`);
    return item;
  });
  const commonOptions = {
    now: fixture.now, endpoint: options.endpoint, model: options.model, modelSha256: options.modelSha256,
    maxTokens: options.maxTokens ?? 650, timeoutMs: options.timeoutMs ?? 240000,
    enableThinking: options.enableThinking,
  };
  const entries = selected.flatMap(item => orders.map(outputOrder => {
    const a = publicPost(item.a), b = publicPost(item.b);
    const built = buildSemanticPairRequest(a, b, { ...commonOptions, outputOrder });
    return { pairId: item.id, kind: 'hall', expected: item.expected, outputOrder, a, b, built };
  }));
  return { now: fixture.now, commonOptions, entries };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--dry-run')) throw new Error('Only --dry-run is supported; output may be set with MATCH_EVAL_OUTPUT');
  const raw = readFileSync(fixturePath, 'utf8');
  const thinking = process.env.MATCH_SEMANTIC_ENABLE_THINKING;
  if (thinking !== undefined && !['true', 'false'].includes(thinking)) throw new Error('MATCH_SEMANTIC_ENABLE_THINKING must be true or false');
  const plan = buildSemanticOrderProbePlan(JSON.parse(raw), {
    endpoint: process.env.MATCH_SEMANTIC_ENDPOINT,
    model: process.env.MATCH_SEMANTIC_MODEL,
    modelSha256: process.env.MATCH_SEMANTIC_MODEL_SHA256,
    enableThinking: thinking === undefined ? undefined : thinking === 'true',
    maxTokens: process.env.MATCH_SEMANTIC_MAX_TOKENS === undefined ? undefined : Number(process.env.MATCH_SEMANTIC_MAX_TOKENS),
    timeoutMs: process.env.MATCH_SEMANTIC_TIMEOUT_MS === undefined ? undefined : Number(process.env.MATCH_SEMANTIC_TIMEOUT_MS),
  });
  const output = resolve(process.env.MATCH_EVAL_OUTPUT || 'reports/match-iteration-2026-09-11/iteration-10');
  const started = performance.now();
  const manifest = {
    status: 'targeted_order_diagnostic_not_acceptance_evidence',
    fixturePath, fixtureSha256: hash(raw), now: plan.now,
    selection: 'First hall match and first hall uncertain pair in validation-v2 file order; decision-first then evidence-first for each pair',
    execution: 'Four serial requests; identical inputs and generation configuration within each pair, only output order differs; no application result cache',
    sourceSha256: {
      probe: hash(readFileSync(new URL('./semantic-order-probe.mjs', import.meta.url))),
      client: hash(readFileSync(new URL('./semantic-pair-client.mjs', import.meta.url))),
      publicInput: hash(readFileSync(new URL('../../lib/match/semantic-schema.ts', import.meta.url))),
    },
    plannedRequests: plan.entries.map((entry, index) => ({
      sequence: index + 1, pairId: entry.pairId, expected: entry.expected, outputOrder: entry.outputOrder,
      key: entry.built.key, endpoint: entry.built.endpoint, model: entry.built.model, modelSha256: entry.built.modelSha256,
      promptSha256: entry.built.promptSha256, schemaSha256: entry.built.schemaSha256,
      generation: { temperature: entry.built.request.temperature, seed: entry.built.request.seed, maxTokens: entry.built.request.max_tokens, cachePrompt: entry.built.request.cache_prompt, timeoutMs: entry.built.timeoutMs, chatTemplateKwargs: entry.built.request.chat_template_kwargs },
    })),
  };
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ dryRun: true, output, ...manifest }, null, 2));
    return;
  }
  mkdirSync(output, { recursive: true });
  // Do not truncate an earlier run or conceal a partially completed experiment.
  writeFileSync(`${output}/order-results.jsonl`, '', { flag: 'wx', mode: 0o600 });
  writeFileSync(`${output}/order-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(`${output}/order-requests.jsonl`, plan.entries.map((entry, index) => JSON.stringify({
    sequence: index + 1, pairId: entry.pairId, outputOrder: entry.outputOrder,
    key: entry.built.key, promptSha256: entry.built.promptSha256, schemaSha256: entry.built.schemaSha256,
    request: entry.built.request,
  })).join('\n') + '\n', { mode: 0o600 });
  const rows = [];
  for (const [index, entry] of plan.entries.entries()) {
    const callStarted = performance.now();
    let row;
    try {
      const result = await judgeSemanticPair(entry.a, entry.b, {
        ...plan.commonOptions, outputOrder: entry.outputOrder, logPath: `${output}/order-client.jsonl`,
      });
      row = { sequence: index + 1, pairId: entry.pairId, expected: entry.expected, outputOrder: entry.outputOrder,
        decision: result.validation.ok ? result.validation.judgment.decision : 'invalid', result };
    } catch (error) {
      row = { sequence: index + 1, pairId: entry.pairId, expected: entry.expected, outputOrder: entry.outputOrder,
        decision: 'error', ms: performance.now() - callStarted, error: error.message,
        key: entry.built.key, promptSha256: entry.built.promptSha256, schemaSha256: entry.built.schemaSha256 };
    }
    rows.push(row);
    appendFileSync(`${output}/order-results.jsonl`, `${JSON.stringify(row)}\n`, { mode: 0o600 });
    const progress = rows.map(item => ({
      sequence: item.sequence, pairId: item.pairId, expected: item.expected, outputOrder: item.outputOrder,
      decision: item.decision, ms: item.result?.ms ?? item.ms, usage: item.result?.usage ?? null,
      cacheHit: item.result?.cacheHit ?? false, validation: item.result?.validation ?? null, error: item.error,
    }));
    writeFileSync(`${output}/order-summary.json`, `${JSON.stringify({ ...manifest, completedRequests: rows.length,
      totalMs: performance.now() - started, rows: progress }, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify(progress.at(-1)));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
