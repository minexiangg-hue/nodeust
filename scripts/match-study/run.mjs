import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,appendFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import {generate,compatible,normalizeHall,SEED} from './generate.mjs';
import {findReciprocalHousingMatches} from '../../lib/matching.ts';
const out=resolve(process.env.MATCH_STUDY_OUTPUT||'reports/match-study-2026-09-11/artifacts');
const base=process.env.NODE_TEST_BASE_URL;assert.equal(base,'http://127.0.0.1:3102');
const schema=new URL(process.env.DATABASE_URL).pathname.slice(1);assert.match(schema,/^nodeust_matchstudy_[a-f0-9]{8}$/);
assert.ok(process.env.NODE_TRUSTED_PROXY_SECRET?.length>=32);
mkdirSync(out,{recursive:true});assert.ok(!existsSync(out+'/summary.json'),'Refuse to overwrite a completed run');
const db=await mysql.createConnection(process.env.DATABASE_URL);
const [[identity]]=await db.query('SELECT DATABASE() AS name');assert.equal(identity.name,schema);
const [visible]=await db.query('SHOW DATABASES');assert.ok(visible.every(r=>[schema,'information_schema','performance_schema'].includes(r.Database)));
const [existing]=await db.query('SELECT identity_id FROM users');assert.ok(existing.every(r=>r.identity_id.startsWith('transport-qa-')),'Refuse to erase anything except known disposable QA fixtures');
for(const table of ['contact_exchange_requests','messages','conversation_participants','conversations','reports','moderation_actions','feedback','announcements','posts','users'])await db.query(`DELETE FROM \`${table}\``);
const started=new Date().toISOString();const data=generate();assert.equal(data.students.length,500);assert.ok(data.students.every(s=>s.postCount>=5&&s.postCount<=10));
writeFileSync(out+'/students.json',JSON.stringify(data.students,null,2));writeFileSync(out+'/api-log.jsonl','');
const log=value=>appendFileSync(out+'/api-log.jsonl',JSON.stringify(value)+'\n');
const headers=id=>({'content-type':'application/json','x-hkust-uid':id,'x-hkust-email':`${id}@connect.ust.hk`,'x-node-proxy-secret':process.env.NODE_TRUSTED_PROXY_SECRET});
async function api(id,path,method='GET',body,localId){const begin=performance.now();const r=await fetch(base+path,{method,headers:headers(id),body:body?JSON.stringify(body):undefined});const result=await r.json();log({at:new Date().toISOString(),studentId:id,method,path,localId,status:r.status,ms:Math.round((performance.now()-begin)*100)/100,id:result.id,error:result.error});if(!r.ok)throw Error(`API failure ${r.status} ${localId||path}: ${result.error}`);return result;}
async function parallel(values,fn,concurrency=6){let cursor=0;await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<values.length){const i=cursor++;await fn(values[i],i);}}));}
await parallel(data.students,async student=>{student.profile=(await api(student.id,'/api/profile')).profile.id;});
// All 500 are evaluated as ordinary members; initial-owner bootstrap is not under test.
await db.query("UPDATE users SET role='member'");
let completed=0;await parallel(data.posts,async p=>{const result=await api(p.studentId,'/api/posts','POST',p.payload,p.localId);p.id=result.id;if(++completed%500===0)console.log(`Posted ${completed}/${data.posts.length}`);});
const [stored]=await db.query('SELECT p.id,p.owner_id,p.category,p.title,p.body,p.current_hall,p.target_hall,p.created_at,u.identity_id FROM posts p JOIN users u ON u.id=p.owner_id ORDER BY p.created_at DESC,p.id DESC');
assert.equal(stored.length,data.posts.length);const byId=new Map(data.posts.map(p=>[p.id,p]));
for(const row of stored){const p=byId.get(row.id);assert.equal(p.studentId,row.identity_id);assert.equal(p.payload.category,row.category);assert.equal(p.payload.currentHall,row.current_hall);assert.equal(p.payload.targetHall,row.target_hall);p.createdAt=row.created_at.toISOString();}
writeFileSync(out+'/posts.jsonl',data.posts.map(p=>JSON.stringify(p)).join('\n')+'\n');
const own=new Map(data.students.map(s=>[s.id,data.posts.filter(p=>p.studentId===s.id)]));
const gold=new Map(data.students.map(s=>[s.id,new Set()]));const routeGold=new Map(data.students.map(s=>[s.id,new Set()]));
for(let i=0;i<data.posts.length;i++)for(let j=i+1;j<data.posts.length;j++){
 const a=data.posts[i],b=data.posts[j];if(a.studentId===b.studentId)continue;
 if(compatible(a,b)){gold.get(a.studentId).add(b.id);gold.get(b.studentId).add(a.id);}
 if(a.truth.actionable&&b.truth.actionable&&a.truth.kind==='hall'&&b.truth.kind==='hall'&&a.truth.from===b.truth.to&&a.truth.to===b.truth.from){routeGold.get(a.studentId).add(b.id);routeGold.get(b.studentId).add(a.id);}
}
const all=stored.map(row=>({id:row.id,owner:row.identity_id,category:row.category,from:row.current_hall??'',to:row.target_hall??''}));
const normalized=all.map(p=>({...p,from:normalizeHall(p.from),to:normalizeHall(p.to)})).filter(p=>p.from&&p.to&&p.from!==p.to);
const metrics={};const types=['hall','goods','study','transport','other'];
for(const name of ['current-feed','full-exact','full-normalized'])metrics[name]={roles:0,empty:0,eligibleRoles:0,hitRoles:0,returned:0,tp:0,gold:0,routeTp:0,routeGold:0,top5Count:0,top5Tp:0,byKind:Object.fromEntries(types.map(t=>[t,{returned:0,tp:0,gold:0}]))};
const roles=[];
function score(name,ids,student){const expected=gold.get(student);const routeExpected=routeGold.get(student);const m=metrics[name];const tp=ids.filter(id=>expected.has(id));m.roles++;m.empty+=Number(!ids.length);m.eligibleRoles+=Number(expected.size>0);m.hitRoles+=Number(tp.length>0);m.returned+=ids.length;m.tp+=tp.length;m.gold+=expected.size;m.routeTp+=ids.filter(id=>routeExpected.has(id)).length;m.routeGold+=routeExpected.size;m.top5Count+=ids.slice(0,5).length;m.top5Tp+=ids.slice(0,5).filter(id=>expected.has(id)).length;
 for(const id of ids){const b=m.byKind[byId.get(id).truth.kind];b.returned++;b.tp+=Number(expected.has(id));}for(const id of expected)m.byKind[byId.get(id).truth.kind].gold++;
 return {returned:ids,truePositive:tp,falsePositive:ids.filter(id=>!expected.has(id)),falseNegative:[...expected].filter(id=>!ids.includes(id))};}
let evaluated=0;await parallel(data.students,async student=>{
 const profile=(await api(student.id,'/api/profile')).profile;assert.equal(profile.role,'member');
 const response=await api(student.id,'/api/posts');const feed=response.items;assert.equal(feed.length,100);assert.deepEqual(feed.map(p=>p.id),all.slice(0,100).map(p=>p.id));
 assert.ok(feed.every(p=>p.isMine===(byId.get(p.id).studentId===student.id)));assert.ok(feed.every(p=>!('ownerId' in p)));
 const converted=feed.map(p=>({id:p.id,category:p.category,mine:p.isMine,from:p.currentHall??'',to:p.targetHall??''}));
 const baseline=findReciprocalHousingMatches(converted).map(p=>p.id);
 const full=findReciprocalHousingMatches(all.map(p=>({...p,mine:p.owner===student.id}))).map(p=>p.id);
 const norm=findReciprocalHousingMatches(normalized.map(p=>({...p,mine:p.owner===student.id}))).map(p=>p.id);
 const result={studentId:student.id,style:student.style,ownPosts:own.get(student.id).map(p=>p.id),feed:feed.map(p=>({id:p.id,isMine:p.isMine})),ownPostsInFeed:feed.filter(p=>p.isMine).length,ownHousingInFeed:feed.filter(p=>p.isMine&&p.category==='hall').length,gold:[...gold.get(student.id)],routeGold:[...routeGold.get(student.id)],algorithms:{'current-feed':score('current-feed',baseline,student.id),'full-exact':score('full-exact',full,student.id),'full-normalized':score('full-normalized',norm,student.id)}};
 roles.push(result);if(++evaluated%100===0)console.log(`Evaluated ${evaluated}/500 real member views`);
});
roles.sort((a,b)=>a.studentId.localeCompare(b.studentId));writeFileSync(out+'/roles.jsonl',roles.map(r=>JSON.stringify(r)).join('\n')+'\n');
const counts=field=>data.posts.reduce((a,p)=>{const k=field(p);a[k]=(a[k]||0)+1;return a;},{});
const apiLogs=readFileSync(out+'/api-log.jsonl','utf8').trim().split('\n').map(JSON.parse);
const summary={seed:SEED,started,finished:new Date().toISOString(),students:500,posts:data.posts.length,perStudent:{min:Math.min(...data.students.map(s=>s.postCount)),max:Math.max(...data.students.map(s=>s.postCount))},styles:counts(p=>p.style),intentTypes:counts(p=>p.truth.kind),submittedCategories:counts(p=>p.payload.category),misclassified:data.posts.filter(p=>p.truth.kind!==p.payload.category).length,insufficient:data.posts.filter(p=>!p.truth.actionable).length,rolesWithNoOwnPostsInFeed:roles.filter(r=>!r.ownPostsInFeed).length,rolesWithNoOwnHousingInFeed:roles.filter(r=>!r.ownHousingInFeed).length,metrics,api:{requests:apiLogs.length,failures:apiLogs.filter(r=>r.status>=400).length,p50ms:apiLogs.map(r=>r.ms).sort((a,b)=>a-b)[Math.floor(apiLogs.length*.5)],p95ms:apiLogs.map(r=>r.ms).sort((a,b)=>a-b)[Math.floor(apiLogs.length*.95)]},corpusSha256:createHash('sha256').update(readFileSync(out+'/posts.jsonl')).digest('hex'),notes:['Synthetic scenario oracle; no independent human relevance labels.','All predictions consume public API fields, never the truth labels.','full-exact and full-normalized are offline ablations, not deployed algorithms.','500 roles use the real API and the exact shared UI matcher; browser sampling is separate.']};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));await db.end();console.log(JSON.stringify(summary,null,2));
