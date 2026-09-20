import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
import {MatchIndex,rankMatches,MATCH_VERSION} from '../../lib/match/engine.ts';
assert.equal(process.env.NODE_EMAIL_TEST_MODE,'true');
assert.equal(process.env.NODE_EMAIL_ORIGIN,'http://127.0.0.1:3104');
const schema=new URL(process.env.NODE_EMAIL_DATABASE_URL).pathname.slice(1);
assert.match(schema,/^nodeust_email_test_[a-f0-9]{8}$/);
const source=readFileSync('reports/match-study-2026-09-11/artifacts/posts.jsonl','utf8');
const raw=source.trim().split('\n').map(JSON.parse);
assert.equal(raw.length,3746);
const studentNames=[...new Set(raw.map(p=>p.studentId))];assert.equal(studentNames.length,500);
const users=new Map(studentNames.map(name=>[name,{id:randomUUID(),account:randomUUID(),token:randomBytes(32).toString('base64url')} ]));
const posts=raw.map(p=>({id:randomUUID(),ownerId:users.get(p.studentId).id,category:p.payload.category,title:p.payload.title,body:p.payload.body,locationId:p.payload.locationId,currentHall:p.payload.currentHall,targetHall:p.payload.targetHall,createdAt:p.createdAt,status:'active'}));
const out='reports/match-iteration-2026-09-19/email-full-replay';mkdirSync(out,{recursive:true});
const db=await mysql.createConnection({uri:process.env.NODE_EMAIL_DATABASE_URL,timezone:'Z'});
const userIds=[...users.values()].map(u=>u.id),marks=userIds.map(()=>'?').join(',');
const logs=[];let committed=false;
try {
 const [visible]=await db.query('SHOW DATABASES');assert.ok(visible.every(r=>[schema,'information_schema','performance_schema'].includes(r.Database)));
 await db.beginTransaction();
 for(const u of users.values()) {
  const email=`replay-${u.id}@connect.ust.hk`;
  await db.execute("INSERT INTO users(id,identity_id,email,affiliation,full_name,nickname,anonymous_alias,role,status,created_at,updated_at) VALUES (?,?,?,'student','Replay','Replay','Replay','member','active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[u.id,u.id,email]);
  await db.execute("INSERT INTO email_accounts(id,email,password_hash,user_id,verified_at,created_at,updated_at) VALUES (?,?,'unusable-replay-password',?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[u.account,email,u.id]);
  await db.execute('INSERT INTO email_sessions(token_hash,account_id,expires_at,created_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR),UTC_TIMESTAMP(3))',[createHash('sha256').update(u.token).digest('hex'),u.account]);
 }
 for(const p of posts)await db.execute("INSERT INTO posts(id,owner_id,category,title,body,location_id,current_hall,target_hall,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'active',?,?)",[p.id,p.ownerId,p.category,p.title,p.body,p.locationId,p.currentHall,p.targetHall,new Date(p.createdAt),new Date(p.createdAt)]);
 await db.commit();committed=true;
 const index=new MatchIndex(posts),now=new Date();
 let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{
  while(cursor<studentNames.length){
   const student=studentNames[cursor++],u=users.get(student);
   const own=posts.filter(p=>p.ownerId===u.id).map(p=>index.posts.get(p.id));
   const expected=rankMatches(own,[...index.candidates(own)].map(id=>index.posts.get(id)),now).filter(r=>r.confidence==='high');
   const ids=[];let pages=0,total;
   for(let page=0;page<200;page++){
    const response=await fetch(`${process.env.NODE_EMAIL_ORIGIN}/api/matches?page=${page}`,{headers:{cookie:`nodeust_email_test_session=${u.token}`}});
    assert.equal(response.status,200,student);assert.match(response.headers.get('cache-control'),/private.*no-store/);
    const body=await response.json();assert.equal(body.ownPostCount,own.length);assert.equal(body.version,MATCH_VERSION);
    total=body.total;assert.ok(body.items.length<=25);pages++;
    for(const item of body.items){assert.equal(item.match.confidence,'high');assert.ok(own.some(p=>p.post.id===item.match.ownPostId));for(const field of ['ownerId','identityId','email','fullName','contactValue'])assert.ok(!(field in item));ids.push(item.id);}
    if(!body.hasMore)break;assert.ok(page<199);
   }
   assert.equal(ids.length,total);assert.equal(new Set(ids).size,ids.length);assert.deepEqual(ids,expected.map(r=>r.post.id),student);
   logs.push({student,ownPosts:own.length,pages,returned:ids.length,pass:true});
   if(logs.length%100===0)console.log(`Verified ${logs.length}/500 email roles`);
  }
 }));
 writeFileSync(`${out}/summary.json`,JSON.stringify({version:MATCH_VERSION,now:now.toISOString(),sourceSha256:createHash('sha256').update(source).digest('hex'),students:logs.length,posts:posts.length,requests:logs.reduce((s,r)=>s+r.pages,0),recommendations:logs.reduce((s,r)=>s+r.returned,0),method:'Seeded verified test accounts and hashed sessions, actual email-session API compared with current public-input engine. Tests integration parity, not independent semantic correctness or 500 registration flows.',roles:logs},null,2)+'\n');
} finally {
 if(!committed)await db.rollback();
 await db.execute(`DELETE FROM posts WHERE owner_id IN (${marks})`,userIds);
 await db.execute(`DELETE FROM email_accounts WHERE user_id IN (${marks})`,userIds);
 await db.execute(`DELETE FROM users WHERE id IN (${marks})`,userIds);
 await db.end();
}
