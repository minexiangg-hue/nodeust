import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {random,generate,compatible,normalizeHall} from './generate.mjs';
import {findReciprocalHousingMatches} from '../../lib/matching.ts';
const out=resolve(process.env.MATCH_STUDY_OUTPUT||'reports/match-study-2026-09-11/artifacts');
const lines=name=>readFileSync(out+'/'+name,'utf8').trim().split('\n').map(JSON.parse);
const posts=lines('posts.jsonl'),roles=lines('roles.jsonl');const byId=new Map(posts.map(p=>[p.id,p]));const roleById=new Map(roles.map(r=>[r.studentId,r]));
const generated=new Map(generate().posts.map(p=>[p.localId,p]));for(const p of posts){assert.deepEqual(p.payload,generated.get(p.localId).payload);assert.deepEqual(p.truth,generated.get(p.localId).truth);}
const ordered=[...posts].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||(a.id>b.id?-1:1));
const shape=(p,student)=>({id:p.id,category:p.payload.category,mine:p.studentId===student,from:p.payload.currentHall??'',to:p.payload.targetHall??''});
const ownMap=new Map(roles.map(r=>[r.studentId,posts.filter(p=>p.studentId===r.studentId)]));
const own=student=>ownMap.get(student);
for(const r of roles){assert.deepEqual(r.feed.map(p=>p.id),ordered.slice(0,100).map(p=>p.id));assert.deepEqual(findReciprocalHousingMatches(ordered.slice(0,100).map(p=>shape(p,r.studentId))).map(p=>p.id),r.algorithms['current-feed'].returned);const expected=posts.filter(p=>own(r.studentId).some(mine=>compatible(mine,p))).map(p=>p.id);assert.deepEqual([...expected].sort(),[...r.gold].sort());}
const sensitivity=[];
for(let seed=1;seed<=30;seed++){
 const shuffled=[...posts],rng=random(9000+seed);for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 let returned=0,tp=0,empty=0,hits=0;
 for(const r of roles){const ids=findReciprocalHousingMatches(shuffled.slice(0,100).map(p=>shape(p,r.studentId))).map(p=>p.id);const n=ids.filter(id=>r.gold.includes(id)).length;returned+=ids.length;tp+=n;empty+=Number(!ids.length);hits+=Number(n>0);}
 sensitivity.push({seed:9000+seed,returned,truePositive:tp,empty,hitRoles:hits,precision:returned?tp/returned:null,recall:tp/roles.reduce((n,r)=>n+r.gold.length,0)});
}
const cases=[];
function record(label,student,a,b,reason){cases.push({label,studentId:student,own:{id:a.id,localId:a.localId,...a.payload,truth:a.truth},candidate:{id:b.id,localId:b.localId,...b.payload,truth:b.truth},reason});}
for(const r of roles.filter(r=>r.algorithms['current-feed'].falsePositive.length)){
 const b=byId.get(r.algorithms['current-feed'].falsePositive[0]);const a=own(r.studentId).find(a=>a.payload.category==='hall'&&a.payload.currentHall===b.payload.targetHall&&a.payload.targetHall===b.payload.currentHall&&r.feed.some(f=>f.id===a.id));record('current-false-positive',r.studentId,a,b,'Both records were submitted as housing with reciprocal placeholder fields; their actual requests are incompatible.');
}
for(const kind of ['hall','goods','study','transport','other']){
 let found=false;for(const r of roles){const id=r.algorithms['current-feed'].falseNegative.find(id=>byId.get(id).truth.kind===kind);if(!id)continue;const b=byId.get(id),a=own(r.studentId).find(p=>compatible(p,b));record('missed-'+kind,r.studentId,a,b,kind==='hall'?'Compatible housing pair outside the usable feed/field equality boundary.':'Existing matcher has no intentional matching rule for this kind.');found=true;break;}assert.ok(found);
}
outer:for(const r of roles)for(const id of r.algorithms['full-exact'].falseNegative){const b=byId.get(id);if(b.payload.category!=='hall'||b.truth.kind!=='hall')continue;const a=own(r.studentId).find(a=>a.payload.category==='hall'&&compatible(a,b)&&normalizeHall(a.payload.currentHall)===normalizeHall(b.payload.targetHall)&&normalizeHall(a.payload.targetHall)===normalizeHall(b.payload.currentHall));if(a){record('housing-alias',r.studentId,a,b,'Canonical hall IDs agree, exact stored strings do not.');break outer;}}
outer:for(const r of roles)for(const id of r.algorithms['full-normalized'].falsePositive){const b=byId.get(id);if(b.truth.kind!=='hall'||!b.truth.actionable)continue;const a=own(r.studentId).find(a=>a.truth.kind==='hall'&&a.truth.actionable&&a.payload.category==='hall'&&a.truth.from===b.truth.to&&a.truth.to===b.truth.from);if(a){record('housing-constraints',r.studentId,a,b,'Reverse route agrees, but no own request satisfies all declared term, room-type and eligibility conditions.');break outer;}}
const buckets={};for(const style of [...new Set(posts.map(p=>p.style))]){const selected=roles.filter(r=>r.style===style);buckets[style]={students:selected.length,empty:selected.filter(r=>!r.algorithms['current-feed'].returned.length).length,hits:selected.filter(r=>r.algorithms['current-feed'].truePositive.length).length};}
const diagnostics={replayVerified:true,semanticGeneratorVerified:true,sensitivity,byStudentStyle:buckets,cases};
writeFileSync(out+'/diagnostics.json',JSON.stringify(diagnostics,null,2));
console.log(JSON.stringify({replayVerified:true,cases:cases.length,sensitivity:{runs:30,emptyMin:Math.min(...sensitivity.map(r=>r.empty)),emptyMax:Math.max(...sensitivity.map(r=>r.empty)),truePositiveMin:Math.min(...sensitivity.map(r=>r.truePositive)),truePositiveMax:Math.max(...sensitivity.map(r=>r.truePositive)),maxRecall:Math.max(...sensitivity.map(r=>r.recall))},byStudentStyle:buckets},null,2));
