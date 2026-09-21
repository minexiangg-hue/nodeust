import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {MatchIndex,rankMatches} from '../../lib/match/engine.ts';
const docs=readFileSync('reports/match-study-2026-09-11/artifacts/posts.jsonl','utf8').trim().split('\n').map(l=>{const p=JSON.parse(l);return {...p.payload,id:p.id,ownerId:p.studentId,createdAt:p.createdAt,status:'active'};});
const started=performance.now(),index=new MatchIndex(docs),buildMs=performance.now()-started;
const owners=new Map();for(const p of index.posts.values()){const a=owners.get(p.post.ownerId)||[];a.push(p);owners.set(p.post.ownerId,a);}
const rows=[];
for(const [owner,own] of owners){const start=performance.now();const ids=index.candidates(own);const candidates=[...ids].map(id=>index.posts.get(id)).filter(p=>p.post.ownerId!==owner);const ranked=rankMatches(own,candidates,new Date('2026-09-11T04:00:00Z'));rows.push({owner,ms:performance.now()-start,candidates:candidates.length,returned:ranked.length});}
const times=rows.map(r=>r.ms).sort((a,b)=>a-b);const summary={posts:docs.length,owners:owners.size,buildMs,p50Ms:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1),meanCandidates:rows.reduce((s,r)=>s+r.candidates,0)/rows.length,memoryRSS:process.memoryUsage().rss,scope:'Pure in-memory algorithm; existing synthetic corpus at original simulation time, no database/network; all owners queried once'};
writeFileSync('reports/match-practical-2026-09-21/performance.json',JSON.stringify({summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
