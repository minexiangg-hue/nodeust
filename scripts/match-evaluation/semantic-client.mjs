import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  semanticMessages, semanticPublicInput, SEMANTIC_RESPONSE_FORMAT,
  validateSemanticResponse,
} from '../../lib/match/semantic-schema.ts';
import { semanticEvidenceSources } from './semantic-ledger.mjs';

export const SEMANTIC_MODEL = 'nodeust-qwen3-4b-instruct-2507-q8';
export const SEMANTIC_MODEL_SHA256 = 'ae916ede1c010a26955ee8ae2e908bf8815a3f135ec860439ab924701c69d5f1';

/** Resolve only bounded public source references; never invent or normalize evidence text. */
export function resolveSemanticReferences(post, raw) {
  const sources = semanticEvidenceSources(post);
  let value;
  try { value = JSON.parse(raw); } catch { return { ok:false, errors:['invalid-reference-json'] }; }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.intents))
    return { ok:false, errors:['invalid-reference-intents'] };
  for (const intent of value.intents) {
    if (!intent || typeof intent !== 'object' || !Array.isArray(intent.evidence))
      return {ok:false,errors:['invalid-evidence-reference']};
    for (const field of ['evidence','otherRequirements']) {
      if (field === 'otherRequirements' && (intent[field] === undefined || intent[field] === null)) continue;
      if (!Array.isArray(intent[field]) || intent[field].some(id => !Number.isInteger(id) || id < 0 || id >= sources.length))
        return {ok:false,errors:[`invalid-reference:${field}`]};
      intent[field] = intent[field].map(id => sources[id].text);
    }
  }
  return { ok:true, output:JSON.stringify(value) };
}

/** Local-only experimental client. No production database access or model-side labels. */
export async function extractSemanticPost(post, options = {}) {
  const endpoint = new URL(options.endpoint || 'http://127.0.0.1:8092/v1/chat/completions');
  if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
      || endpoint.username || endpoint.password) throw new Error('Only an unauthenticated local model endpoint is permitted');
  const model = options.model || SEMANTIC_MODEL;
  const modelSha256 = options.modelSha256 || SEMANTIC_MODEL_SHA256;
  const format = options.format ?? 'schema';
  if (!['schema', 'json', 'references'].includes(format)) throw new TypeError('Invalid extraction format');
  if (options.enableThinking !== undefined && typeof options.enableThinking !== 'boolean') throw new TypeError('enableThinking must be boolean');
  if (options.cachePrompt !== undefined && typeof options.cachePrompt !== 'boolean') throw new TypeError('cachePrompt must be boolean');
  const messages = semanticMessages(post);
  let publicInput = semanticPublicInput(post);
  let responseFormat = format === 'json' ? {type:'json_object'} : SEMANTIC_RESPONSE_FORMAT;
  if (format === 'references') {
    const sources = semanticEvidenceSources(post);
    publicInput = { categoryHint:publicInput.categoryHint, postedAt:publicInput.postedAt, timeZone:publicInput.timeZone, sources };
    messages[0].content = messages[0].content
      .replace('Read title, body and explicitFields together;', 'Read all ordered public source segments together;')
      .replace('evidence is 1–4 exact short substrings (3–240 characters each) from title, body or an explicitField VALUE. Copy evidence character for character, preserving language, case and punctuation; never translate or normalize evidence. Together the quotes must support the roles, dates, route, quantities and conditions you output.', 'evidence is an array of 1–4 INTEGER source IDs from the sources array. The application resolves these references to exact original text. Select the segments that support all emitted facts. Never copy or paraphrase evidence text; never use IDs as role, date, money or quantity values.')
      .replace('otherRequirements is at most 4 verbatim strings (3–160 characters)', 'otherRequirements is at most 4 INTEGER source IDs for the extra hard constraints')
      .replace('every evidence quote is exact.', 'every evidence reference identifies a supplied source segment.');
    messages[1].content = JSON.stringify({untrustedPostData:publicInput});
    responseFormat = structuredClone(SEMANTIC_RESPONSE_FORMAT);
    for (const branch of responseFormat.json_schema.schema.properties.intents.items.anyOf) {
      const reference = {type:'integer',minimum:0,maximum:Math.max(0,sources.length-1)};
      branch.properties.evidence.items = reference;
      branch.properties.otherRequirements.items = reference;
    }
  }
  const request = {
    model, messages, response_format: responseFormat,
    temperature: options.temperature ?? 0, seed: 20260911, max_tokens: options.maxTokens || 900,
    ...(options.topP === undefined ? {} : { top_p: options.topP }),
    ...(options.topK === undefined ? {} : { top_k: options.topK }),
    ...(options.minP === undefined ? {} : { min_p: options.minP }),
    cache_prompt: options.cachePrompt ?? true,
    ...(options.enableThinking === undefined ? {} : {chat_template_kwargs:{enable_thinking:options.enableThinking}}),
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
      publicInput, formatMode:format, output: choice?.message?.content,
      finishReason: choice?.finish_reason, usage: body.usage, timings: body.timings,
      generation: { format: request.response_format.type, evidenceFormat:format, cachePrompt:request.cache_prompt, chatTemplateKwargs:request.chat_template_kwargs, temperature: request.temperature, maxTokens: request.max_tokens, topP: request.top_p, topK: request.top_k, minP: request.min_p },
    };
    if (typeof record.output !== 'string') throw new Error('Local extraction response has no text content');
    if (cachePath) {
      await mkdir(cacheDirectory, { recursive: true });
      const temporary = `${cachePath}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(record)}\n`);
      await rename(temporary, cachePath);
    }
  }
  const resolved = format === 'references' ? resolveSemanticReferences(post, record.output) : {ok:true,output:record.output};
  const validation = record.finishReason === 'stop'
    ? (resolved.ok ? validateSemanticResponse(post, resolved.output) : resolved)
    : { ok: false, errors: [`incomplete-generation:${record.finishReason}`] };
  return { ...record, ...(format === 'references' && resolved.ok ? {resolvedOutput:resolved.output} : {}), validation };
}
