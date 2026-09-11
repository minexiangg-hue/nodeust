import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSemanticPairRequest, judgeSemanticPair } from './semantic-pair-client.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const fixturePath = 'scripts/match-evaluation/validation-v2.json';
const raw = readFileSync(fixturePath, 'utf8');
const fixture = JSON.parse(raw);
const positive = fixture.cases.find(row => row.kind === 'hall' && row.expected === 'match');
const negative = fixture.cases.find(row => row.kind === 'hall' && row.expected === 'reject');
const selected = [{item:positive,cachePrompt:false}, {item:negative,cachePrompt:true}, {item:negative,cachePrompt:false}];
if (selected.some(row => !row.item)) throw new Error('Missing fixed diagnostic cases');
const common = { now:fixture.now, protocol:'ledger', model:process.env.MATCH_SEMANTIC_MODEL,
  modelSha256:process.env.MATCH_SEMANTIC_MODEL_SHA256, enableThinking:false };
if (!common.model || !common.modelSha256) throw new Error('Explicit model identity is required');
const output = process.env.MATCH_EVAL_OUTPUT;
if (!output) throw new Error('A new output directory is required');
mkdirSync(output, {recursive:true});
writeFileSync(`${output}/cache-results.jsonl`, '', {flag:'wx'});
const requests = selected.map(({item,cachePrompt}) => {
  const built = buildSemanticPairRequest(item.a,item.b,{...common,cachePrompt});
  return {pairId:item.id, expected:item.expected, cachePrompt, ...built};
});
writeFileSync(`${output}/cache-requests.json`, JSON.stringify({fixturePath,fixtureSha256:hash(raw),
  selection:'First hall match cold, first hall reject with prefix reuse, same reject cold; no application result cache', requests},null,2)+'\n');
const rows=[];
for (const {item,cachePrompt} of selected) {
  const result = await judgeSemanticPair(item.a,item.b,{...common,cachePrompt});
  const row={id:item.id,expected:item.expected,cachePrompt,decision:result.validation.ok?result.validation.judgment.decision:'invalid',result};
  rows.push(row); appendFileSync(`${output}/cache-results.jsonl`,JSON.stringify(row)+'\n');
  console.log(JSON.stringify({id:row.id,cachePrompt,decision:row.decision,ms:result.ms,tokens:result.usage?.completion_tokens}));
}
const cached=rows[1],cold=rows[2];
writeFileSync(`${output}/cache-summary.json`,JSON.stringify({
  status:'targeted_cache_diagnostic_not_accuracy_or_bug_proof',fixtureSha256:hash(raw),
  rows:rows.map(({result,...row})=>({...row,ms:result.ms,usage:result.usage,validation:result.validation})),
  sameRawOutput:cached.result.output===cold.result.output,
  sameParsedOutput:JSON.stringify(JSON.parse(cached.result.output))===JSON.stringify(JSON.parse(cold.result.output)),
  sameDecision:cached.decision===cold.decision,
  limitation:'Different prompt batch sizes can change logits. A difference does not establish a runtime defect; unchanged wrong output does not support cache reuse as the cause of this counterexample.'
},null,2)+'\n');
