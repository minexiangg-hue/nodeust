// Offline development diagnostic. Labels identify misses only; never enter the matcher.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMatchPost, comparePosts, MATCH_VERSION} from '../../lib/match/engine.ts';
const path=process.argv[2] || 'scripts/match-evaluation/validation-v2.json';
const output=process.argv[3] || 'reports/match-iteration-2026-09-19/diagnosis.json';
const source=readFileSync(path,'utf8');
const fixture=JSON.parse(source);
const now=new Date(fixture.now);
if(!Number.isFinite(now.getTime())) throw new Error('Fixture must declare evaluation time');
const rows=fixture.cases.map(c=>{
 const parse=(post,suffix)=>parseMatchPost({...post,id:`${c.id}:${suffix}`,ownerId:suffix,createdAt:post.createdAt||fixture.now});
 const a=parse(c.a,'a'),b=parse(c.b,'b');
 const match=comparePosts(a,b,now);
 const intents=[a,b].map(p=>p.intents.filter(i=>i.kind===c.kind));
 const predicted=match?.confidence==='high'?'match':match?'uncertain':'reject';
 // This is a stage diagnostic, not a claim that a rejected comparison is erroneous.
 const stage=predicted==='match'?'high':intents.some(i=>!i.length)?'intent-not-extracted':match?'missing-details':'comparison-rejected';
 return {id:c.id,kind:c.kind,expected:c.expected,predicted,stage,
  missing:match?.missing||[],parsedMissing:intents.map(side=>[...new Set(side.flatMap(i=>i.missing))]),
  intents:intents.map(side=>side.map(({evidence: _evidence,...facts})=>facts))};
});
const kinds=['hall','goods','study','transport','other'];
const byKind=Object.fromEntries(kinds.map(kind=>{
 const positive=rows.filter(r=>r.kind===kind&&r.expected==='match');
 const stages={};const fields={};
 for(const row of positive){stages[row.stage]=(stages[row.stage]||0)+1;
  if(row.stage!=='high')for(const f of new Set([...row.missing,...row.parsedMissing.flat()]))fields[f]=(fields[f]||0)+1;
 }
 return [kind,{positive:positive.length,stages,missingFields:fields,
 falseHigh:rows.filter(r=>r.kind===kind&&r.expected!=='match'&&r.predicted==='match').map(r=>r.id)}];
}));
const report={version:MATCH_VERSION,source:path,sha256:createHash('sha256').update(source).digest('hex'),now:fixture.now,
 note:'Exposed development set. Stage counts are descriptive, not independent validation. Missing fields may coexist with other errors.',byKind,rows};
mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(byKind,null,2));
