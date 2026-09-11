// Labels never enter parser/index inputs. Archived synthetic data is development data.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { MatchIndex, parseMatchPost, rankMatches, comparePosts, MATCH_VERSION } from '../../lib/match/engine.ts';
import { compatible } from '../match-study/generate.mjs';

const kinds = ['hall','goods','study','transport','other'];
const now = new Date('2026-09-11T04:00:00Z');
const directory = process.env.MATCH_EVAL_OUTPUT || 'reports/match-iteration-2026-09-11/artifacts';
mkdirSync(directory,{recursive:true});
const stat = () => ({gold:0,returned:0,truePositive:0,top5Returned:0,top5True:0,eligible:0,hit:0,slots:0,attainable:0});
const ratio = (a,b) => b ? a/b : null;
const metrics = s => ({...s,precision:ratio(s.truePositive,s.returned),recall:ratio(s.truePositive,s.gold),top5Precision:ratio(s.top5True,s.top5Returned),pAt5:ratio(s.top5True,s.slots),fillRate:ratio(s.top5Returned,s.slots),hitRate:ratio(s.hit,s.eligible),attainableTop5Recall:ratio(s.top5True,s.attainable)});
const input = (p) => ({
  id:p.id,ownerId:p.studentId,category:p.payload.category,title:p.payload.title,body:p.payload.body,
  currentHall:p.payload.currentHall,targetHall:p.payload.targetHall,locationId:p.payload.locationId,
  createdAt:p.createdAt,status:'active',
});
const raw = readFileSync('reports/match-study-2026-09-11/artifacts/posts.jsonl','utf8');
const posts=raw.trim().split('\n').map(line=>JSON.parse(line));
const byId=new Map(posts.map(p=>[p.id,p]));
const students=[...new Set(posts.map(p=>p.studentId))].sort((a,b)=>a<b?-1:a>b?1:0);
const started=performance.now();
const index=new MatchIndex(posts.map(input));
const indexedMs=performance.now()-started;
const parsedLogs = [...index.posts.values()].map(row=>({id:row.post.id,localId:byId.get(row.post.id).localId,intents:row.intents,warnings:row.warnings}));
writeFileSync(`${directory}/parsed.jsonl`,parsedLogs.map(row=>JSON.stringify(row)).join('\n')+'\n');
const totals=Object.fromEntries(kinds.map(kind=>[kind,stat()]));
const roleLogs=[];
let candidateCount=0;
for(const studentId of students){
 const mine=posts.filter(p=>p.studentId===studentId);
 const own=mine.map(p=>index.posts.get(p.id));
 const gold=new Set(posts.filter(p=>mine.some(m=>compatible(m,p))).map(p=>p.id));
 const ids=index.candidates(own);candidateCount+=ids.size;
 const ranked=rankMatches(own,[...ids].map(id=>index.posts.get(id)),now);
 const high=ranked.filter(row=>row.confidence==='high');
 const highIds=high.map(row=>row.post.id);
 const details={};
 for(const kind of kinds){
  // Stratify by intended candidate kind for gold/recall; recommendations by inferred kind.
  // Cross-kind false positives remain penalized in their inferred bucket.
  const g=[...gold].filter(id=>byId.get(id).truth.kind===kind);
  const r=high.filter(row=>row.kind===kind);
  const correct=row=>gold.has(row.post.id) && byId.get(row.post.id).truth.kind===kind;
  const top=r.slice(0,5);const s=totals[kind];
  s.gold+=g.length;s.returned+=r.length;s.truePositive+=r.filter(correct).length;
  s.top5Returned+=top.length;s.top5True+=top.filter(correct).length;
  s.eligible+=Number(g.length>0);s.hit+=Number(top.some(correct));s.slots+=5;s.attainable+=Math.min(5,g.length);
  details[kind]={gold:g.length,returned:r.length,top5:top.map(row=>({id:row.post.id,correct:correct(row)}))};
 }
 roleLogs.push({studentId,ownIds:mine.map(p=>p.id),candidateCount:ids.size,high:high.map(row=>({id:row.post.id,ownPostId:row.ownPostId,kind:row.kind,reasons:row.reasons,correct:gold.has(row.post.id)})),possible:ranked.filter(r=>r.confidence==='possible').map(row=>({id:row.post.id,missing:row.missing})),missed:[...gold].filter(id=>!highIds.includes(id)),byKind:details});
}
const result={version:MATCH_VERSION,now:now.toISOString(),posts:posts.length,students:students.length,sourceSha256:createHash('sha256').update(raw).digest('hex'),indexMs:indexedMs,totalMs:performance.now()-started,meanCandidateCount:candidateCount/students.length,byKind:Object.fromEntries(kinds.map(kind=>[kind,metrics(totals[kind])]))};
result.gates=Object.fromEntries(kinds.map(kind=>{const s=result.byKind[kind];return [kind,{precision:(s.top5Precision??0)>=.9,recall:(s.recall??0)>=.6,hitRate:(s.hitRate??0)>=.7}];}));
writeFileSync(`${directory}/roles.jsonl`,roleLogs.map(row=>JSON.stringify(row)).join('\n')+'\n');
writeFileSync(`${directory}/summary.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

const holdoutPath = process.env.MATCH_HOLDOUT || 'scripts/match-evaluation/holdout.json';
if(existsSync(holdoutPath)){
 const source=readFileSync(holdoutPath,'utf8');
 const fixture=JSON.parse(source); const cases=Array.isArray(fixture)?fixture:fixture.cases;
 const rows=cases.map(c=>{
  const a=parseMatchPost({...c.a,id:`${c.id}:a`,ownerId:'a',createdAt:c.a.createdAt||now.toISOString()});
  const b=parseMatchPost({...c.b,id:`${c.id}:b`,ownerId:'b',createdAt:c.b.createdAt||now.toISOString()});
  const match=comparePosts(a,b,now);
  const predicted=match?.confidence==='high'?'match':match?'uncertain':'reject';
  return {id:c.id,kind:c.kind,expected:c.expected,predicted,pass:c.expected==='match'?predicted==='match':predicted!=='match',match,a:a.intents,b:b.intents,reason:c.reason};
 });
 const summary={sourceSha256:createHash('sha256').update(source).digest('hex'),cases:rows.length,byKind:Object.fromEntries(kinds.map(kind=>{
  const r=rows.filter(row=>row.kind===kind),positive=r.filter(row=>row.expected==='match'),negative=r.filter(row=>row.expected!=='match');
  const tp=positive.filter(row=>row.predicted==='match').length,fp=negative.filter(row=>row.predicted==='match').length;
  return [kind,{positive:positive.length,negative:negative.length,tp,fp,precision:ratio(tp,tp+fp),recall:ratio(tp,positive.length),falsePositiveRate:ratio(fp,negative.length)}];
 })),failures:rows.filter(row=>!row.pass).map(row=>row.id)};
 summary.gates=Object.fromEntries(kinds.map(kind=>{const s=summary.byKind[kind];return [kind,{precision:(s.precision??0)>=.9,recall:(s.recall??0)>=.75}];}));
 const negative=rows.filter(r=>r.expected!=='match');summary.falsePositiveRate=ratio(negative.filter(r=>r.predicted==='match').length,negative.length);
 writeFileSync(`${directory}/holdout-rows.json`,JSON.stringify(rows,null,2)+'\n');writeFileSync(`${directory}/holdout-summary.json`,JSON.stringify(summary,null,2)+'\n');
 console.log('Frozen scenario evaluation: '+JSON.stringify(summary,null,2));
}
