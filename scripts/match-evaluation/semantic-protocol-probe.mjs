import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extractSemanticPost } from './semantic-client.mjs';
const raw=readFileSync('scripts/match-evaluation/validation-v2.json','utf8');
const item=JSON.parse(raw).cases.find(row=>row.kind==='goods');
const out=process.env.MATCH_EVAL_OUTPUT||'reports/match-iteration-2026-09-11/iteration-07';
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/protocol-posts.jsonl`,'');
const rows=[];
for(const side of ['a','b']){
 const source=item[side];
 const post={id:`${item.id}-${side}`,title:source.title,body:source.body,category:source.category,createdAt:source.createdAt,status:'active'};
 for(const format of ['schema','json']){
  const result=await extractSemanticPost(post,{format,cacheDirectory:'reports/match-iteration-2026-09-11/artifacts/semantic-cache'});
  const row={id:post.id,format,result};rows.push(row);
  appendFileSync(`${out}/protocol-posts.jsonl`,JSON.stringify(row)+'\n');
  const valid=result.validation;
  console.log(JSON.stringify({id:post.id,format,ok:valid.ok,ms:Math.round(result.ms),cacheHit:result.cacheHit,tokens:result.usage?.completion_tokens,
   fields:valid.ok?valid.semantic.map(intent=>Object.keys(intent)):valid.errors}));
  writeFileSync(`${out}/protocol-summary.json`,JSON.stringify({status:'targeted_protocol_diagnostic_not_acceptance_evidence',fixtureSha256:createHash('sha256').update(raw).digest('hex'),selection:'First goods pair, selected to investigate known optional-field omissions',completed:rows.length,rows:rows.map(r=>({id:r.id,format:r.format,ok:r.result.validation.ok,ms:r.result.ms,cacheHit:r.result.cacheHit}))},null,2)+'\n');
 }
}
