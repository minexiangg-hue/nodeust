// Development robustness audit. Category changes preserve content; title replacement may remove facts.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseMatchPost,comparePosts,MATCH_VERSION} from '../../lib/match/engine.ts';
const fixturePath=process.argv[2]||'scripts/match-evaluation/validation-v2.json';
const out=process.argv[3]||'reports/match-iteration-2026-09-19/input-perturbations.json';
const raw=readFileSync(fixturePath,'utf8'),fixture=JSON.parse(raw),now=new Date(fixture.now);
const categories=['hall','goods','study','transport','other'];
const compare=(c,change)=>{
 const sides=['a','b'].map(side=>parseMatchPost(change({...c[side],id:side,ownerId:side,createdAt:c[side].createdAt||fixture.now},side)));
 const result=comparePosts(...sides,now);
 return {confidence:result?.confidence||'reject',kind:result?.kind,missing:result?.missing||[]};
};
const transforms={spaces:s=>s.replace(/ /g,'   '),crlf:s=>s.replace(/\r?\n/g,'\r\n'),uppercase:s=>s.toUpperCase(),fullwidth:s=>s.replace(/[!-~]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xfee0))};
const rows=[];
for(const c of fixture.cases){
 const baseline=compare(c,p=>p);
 for(const side of ['a','b']){
  for(const category of categories){
   const actual=compare(c,(p,s)=>s===side?{...p,category}:p);
   rows.push({id:c.id,kind:c.kind,expected:c.expected,mode:'category',side,value:category,baseline,actual,changed:JSON.stringify(baseline)!==JSON.stringify(actual)});
  }
  for(const [mode,transform] of Object.entries(transforms)){
   const actual=compare(c,(p,s)=>s===side?{...p,title:transform(p.title),body:transform(p.body)}:p);
   rows.push({id:c.id,kind:c.kind,expected:c.expected,mode,side,baseline,actual,changed:JSON.stringify(baseline)!==JSON.stringify(actual)});
  }
  const actual=compare(c,(p,s)=>s===side?{...p,title:'Campus request'}:p);
  rows.push({id:c.id,kind:c.kind,expected:c.expected,mode:'neutral-title',side,baseline,actual,changed:JSON.stringify(baseline)!==JSON.stringify(actual)});
 }
}
const summary=Object.fromEntries(['category','neutral-title',...Object.keys(transforms)].map(mode=>{
 const items=rows.filter(r=>r.mode===mode);
 return [mode,{runs:items.length,changed:items.filter(r=>r.changed).length,lostHigh:items.filter(r=>r.baseline.confidence==='high'&&r.actual.confidence!=='high').length,newHigh:items.filter(r=>r.baseline.confidence!=='high'&&r.actual.confidence==='high').length}];
}));
const report={version:MATCH_VERSION,fixturePath,sha256:createHash('sha256').update(raw).digest('hex'),note:'Exposed development fixture, not independent validation. Neutral titles can remove essential facts; changes require manual review, not automatic failure.',summary,changes:rows.filter(r=>r.changed)};
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
