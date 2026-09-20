// Audit archived development labels against public-input matching evidence.
// Does not change labels, parser behavior, or acceptance thresholds.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory=process.argv[2];
const output=process.argv[3];
if(!directory || !output) throw new Error('Usage: audit-corpus-misses.mjs evaluation-directory output.json');
const corpusPath='reports/match-study-2026-09-11/artifacts/posts.jsonl';
const corpusSource=readFileSync(corpusPath,'utf8');
const lines=text=>text.trim().split('\n').map(JSON.parse);
const posts=lines(corpusSource),byId=new Map(posts.map(p=>[p.id,p]));
const rolesSource=readFileSync(`${directory}/roles.jsonl`,'utf8');
const parsed=lines(readFileSync(`${directory}/parsed.jsonl`,'utf8'));
const kinds=['hall','goods','study','transport','other'];
const byKind=Object.fromEntries(kinds.map(k=>[k,{missedRecommendations:0,uniqueCandidates:new Set(),affectedStudents:new Set(),reasons:{}}]));
for(const role of lines(rolesSource)) {
 const possible=new Map(role.possible.map(p=>[p.id,p]));
 for(const id of role.missed) {
  const candidate=byId.get(id);
  if(!candidate) throw new Error(`Unknown candidate ${id}`);
  const stat=byKind[candidate.truth.kind];
  const match=possible.get(id);
  const reason=match ? [...match.missing].sort((a,b)=>a.localeCompare(b)).join(',') : 'not-returned-as-possible';
  stat.missedRecommendations++;
  stat.uniqueCandidates.add(id);stat.affectedStudents.add(role.studentId);
  stat.reasons[reason]=(stat.reasons[reason]||0)+1;
 }
}
const goodsWithoutCurrency=parsed.filter(p=>p.intents.some(i=>i.kind==='goods'&&i.price>0&&!i.currency));
const report={
 corpus:corpusPath,corpusSha256:createHash('sha256').update(corpusSource).digest('hex'),
 evaluation:directory,rolesSha256:createHash('sha256').update(rolesSource).digest('hex'),
 note:'Counts are student/candidate recommendations, not independent post pairs. Missing currency can belong to either side; candidate text alone does not identify its source. Gold labels are unchanged.',
 byKind:Object.fromEntries(Object.entries(byKind).map(([k,s])=>[k,{...s,uniqueCandidates:s.uniqueCandidates.size,affectedStudents:s.affectedStudents.size}])),
 positivePricePostsWithoutCurrency:goodsWithoutCurrency.length,
 examples:goodsWithoutCurrency.slice(0,12).map(p=>({id:p.id,text:byId.get(p.id).payload,intents:p.intents.filter(i=>i.kind==='goods')})),
};
mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({byKind:report.byKind,positivePricePostsWithoutCurrency:report.positivePricePostsWithoutCurrency},null,2));
