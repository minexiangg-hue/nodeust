import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  semanticMessages, semanticPublicInput, SEMANTIC_RESPONSE_FORMAT,
  validateSemanticResponse,
} from '../../lib/match/semantic-schema.ts';

export const SEMANTIC_MODEL = 'nodeust-qwen3-4b-instruct-2507-q8';
export const SEMANTIC_MODEL_SHA256 = 'ae916ede1c010a26955ee8ae2e908bf8815a3f135ec860439ab924701c69d5f1';

/** Local-only experimental client. No production database access or model-side labels. */
export async function extractSemanticPost(post, options = {}) {
  const endpoint = new URL(options.endpoint || 'http://127.0.0.1:8092/v1/chat/completions');
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
      || endpoint.username || endpoint.password) throw new Error('Only an unauthenticated local model endpoint is permitted');
  const model = options.model || SEMANTIC_MODEL;
  const modelSha256 = options.modelSha256 || SEMANTIC_MODEL_SHA256;
  const messages = semanticMessages(post);
  const request = {
    model, messages, response_format: options.format === 'json' ? { type: 'json_object' } : SEMANTIC_RESPONSE_FORMAT,
    temperature: options.temperature ?? 0, seed: 20260911, max_tokens: options.maxTokens || 900,
    ...(options.topP === undefined ? {} : { top_p: options.topP }),
    ...(options.topK === undefined ? {} : { top_k: options.topK }),
    ...(options.minP === undefined ? {} : { min_p: options.minP }),
    cache_prompt: true,
  };
  const key = createHash('sha256').update(JSON.stringify({ modelSha256, request })).digest('hex');
  const cacheDirectory = options.cacheDirectory ? resolve(options.cacheDirectory) : null;
  const cachePath = cacheDirectory ? `${cacheDirectory}/${key}.json` : null;
  let record;
  if (cachePath) {
    try {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'));
      if (cached.key !== key || cached.modelSha256 !== modelSha256) throw new Error('Mismatched extraction cache');
      record = { ...cached, cacheHit: true };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!record) {
    const started = performance.now();
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error',
      body: JSON.stringify(request), signal: AbortSignal.timeout(options.timeoutMs || 240000),
    });
    if (!response.ok) throw new Error(`Local extraction failed with HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
    const body = await response.json();
    const choice = body.choices?.[0];
    record = {
      key, model, modelSha256, cacheHit: false, ms: performance.now() - started,
      publicInput: semanticPublicInput(post), output: choice?.message?.content,
      finishReason: choice?.finish_reason, usage: body.usage, timings: body.timings,
      generation: { format: request.response_format.type, temperature: request.temperature, maxTokens: request.max_tokens, topP: request.top_p, topK: request.top_k, minP: request.min_p },
    };
    if (typeof record.output !== 'string') throw new Error('Local extraction response has no text content');
    if (cachePath) {
      await mkdir(cacheDirectory, { recursive: true });
      const temporary = `${cachePath}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(record)}\n`);
      await rename(temporary, cachePath);
    }
  }
  const validation = record.finishReason === 'stop'
    ? validateSemanticResponse(post, record.output)
    : { ok: false, errors: [`incomplete-generation:${record.finishReason}`] };
  return { ...record, validation };
}
