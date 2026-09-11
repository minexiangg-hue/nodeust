import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

const schema = new URL(process.env.DATABASE_URL).pathname.slice(1);
assert.match(schema,/^nodeust_matchstudy_[a-f0-9]{8}$/);
assert.equal(process.env.NODE_TEST_BASE_URL,'http://127.0.0.1:3102');
const source=readFileSync('reports/match-study-2026-09-11/artifacts/posts.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line));
const db=await mysql.createConnection({uri:process.env.DATABASE_URL,timezone:'Z'});
try {
 const [visible]=await db.query('SHOW DATABASES');assert.ok(visible.every(row=>[schema,'information_schema','performance_schema'].includes(row.Database)));
 const [[total]]=await db.query('SELECT COUNT(*) AS total FROM users');assert.equal(Number(total.total),0,'Only an empty disposable database may be seeded');
 const students=[...new Set(source.map(post=>post.studentId))].sort((a,b)=>a<b?-1:a>b?1:0);
 assert.equal(students.length,500);assert.equal(source.length,3746);
 const identities=new Map(students.map(id=>[id,crypto.randomUUID()]));
 await db.beginTransaction();
 for(const student of students) await db.execute("INSERT INTO users (id,identity_id,email,affiliation,full_name,nickname,anonymous_alias,role,status,created_at,updated_at) VALUES (?,?,?,'student',?, ?,?,'member','active',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",[identities.get(student),student,`${student}@connect.ust.hk`,student,student,`Synthetic ${student}`]);
 for(const post of source) await db.execute("INSERT INTO posts (id,owner_id,category,title,body,location_id,current_hall,target_hall,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'active',?,?)",[post.id,identities.get(post.studentId),post.payload.category,post.payload.title,post.payload.body,post.payload.locationId,post.payload.currentHall,post.payload.targetHall,new Date(post.createdAt),new Date(post.createdAt)]);
 await db.commit();
 console.log(JSON.stringify({schema,students:500,posts:3746,method:'Replay archived synthetic content and post timestamps into empty restricted schema; no production data'}));
} catch(error) { await db.rollback(); throw error; } finally { await db.end(); }
