import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

assert.equal(process.env.NODE_TEST_BASE_URL,'http://127.0.0.1:3102');
assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/nodeust_matchstudy_[a-f0-9]{8}$/);
const out=process.env.MATCH_EVAL_OUTPUT||'reports/match-iteration-2026-09-11/artifacts';
mkdirSync(out,{recursive:true});
const expected=readFileSync(`${out}/roles.jsonl`,'utf8').trim().split('\n').map(line=>JSON.parse(line));
assert.equal(expected.length,500);
const headers=student=>({'x-hkust-uid':student,'x-hkust-email':`${student}@connect.ust.hk`,'x-node-proxy-secret':process.env.NODE_TRUSTED_PROXY_SECRET});
const base=process.env.NODE_TEST_BASE_URL;
writeFileSync(`${out}/api-log.jsonl`,'');
const logs=[];let cursor=0,completed=0;
const started=performance.now();
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<expected.length){
  const role=expected[cursor++],observed=[];let page=0,total;
  do {
   const begin=performance.now();const response=await fetch(`${base}/api/matches?page=${page}`,{headers:headers(role.studentId)});
   assert.equal(response.status,200,role.studentId);assert.match(response.headers.get('cache-control'),/private.*no-store/);
   const body=await response.json();total=body.total;
   assert.ok(body.items.length<=25);assert.equal(body.ownPostCount,role.ownIds.length);
   for(const item of body.items){
    assert.equal(item.isMine,false);assert.equal(item.match.confidence,'high');assert.ok(role.ownIds.includes(item.match.ownPostId));
    for(const key of ['ownerId','identityId','email','fullName','contactValue','genderEligibility'])assert.ok(!(key in item),`Private field: ${key}`);
   }
   observed.push(...body.items.map(item=>item.id));
   const log={studentId:role.studentId,page,status:response.status,ms:performance.now()-begin,count:body.items.length,total,ids:body.items.map(item=>item.id)};
   logs.push(log);appendFileSync(`${out}/api-log.jsonl`,JSON.stringify(log)+'\n');
   if(!body.hasMore)break;
   assert.ok(++page<200,'Pagination did not terminate');
  }while(page<200);
  assert.equal(observed.length,total);assert.equal(new Set(observed).size,observed.length);
  assert.deepEqual(observed,role.high.map(row=>row.id),`Real API diverged for ${role.studentId}`);
  if(++completed%100===0)console.log(`API verified ${completed}/500 roles`);
 }
}));
const times=logs.map(row=>row.ms).sort((a,b)=>a-b);
const summary={students:500,requests:logs.length,failures:0,totalMs:performance.now()-started,p50ms:times[Math.floor(times.length*.5)],p95ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1),method:'Actual authenticated endpoint and pagination compared with public-input engine predictions for every archived student; restricted MySQL replay'};
writeFileSync(`${out}/api-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
