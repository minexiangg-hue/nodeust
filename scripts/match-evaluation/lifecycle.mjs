import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
const base=process.env.NODE_TEST_BASE_URL;assert.equal(base,'http://127.0.0.1:3102');
const schema=new URL(process.env.DATABASE_URL).pathname.slice(1);assert.match(schema,/^nodeust_matchstudy_[a-f0-9]{8}$/);
const db=await mysql.createConnection({uri:process.env.DATABASE_URL,timezone:'Z'});
const prefix=`match-qa-${Date.now()}`,buyer=`${prefix}-buyer`,seller=`${prefix}-seller`,admin=`${prefix}-admin`;
const ownIds=[],checks=[];
const headers=id=>({'content-type':'application/json','x-hkust-uid':id,'x-hkust-email':`${id}@connect.ust.hk`,'x-node-proxy-secret':process.env.NODE_TRUSTED_PROXY_SECRET});
async function call(id,path,method='GET',body,status=200){
 const options={method,headers:headers(id)};
 if(body!==undefined){
  assert.ok(method!=='GET'&&method!=='HEAD','Request body requires a write method');
  options.body=JSON.stringify(body);
 }
 const r=await fetch(base+path,options);
 const value=await r.json();
 assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(value)}`);
 return value;
}
const input=body=>({category:'other',title:'Synthetic matching lifecycle check',body,locationId:'academic-building'});
const matching=async id=>(await call(buyer,'/api/matches')).items.some(p=>p.id===id);
const sellerBody='Selling my working Casio fx-991CW calculator. Asking HKD 100.';
let sellerUser,adminUser;
try {
 const [visible]=await db.query('SHOW DATABASES');assert.ok(visible.every(row=>[schema,'information_schema','performance_schema'].includes(row.Database)));
 const unauth=await fetch(base+'/api/matches');assert.equal(unauth.status,401);checks.push('unauthenticated rejected');
 const forged=await fetch(base+'/api/matches',{headers:{'x-hkust-uid':buyer,'x-hkust-email':`${buyer}@connect.ust.hk`}});assert.equal(forged.status,401);checks.push('untrusted identity headers rejected');
 await call(buyer,'/api/profile');sellerUser=(await call(seller,'/api/profile')).profile.id;adminUser=(await call(admin,'/api/profile')).profile.id;
 await db.execute("UPDATE users SET role='owner' WHERE id=? AND identity_id=?",[adminUser,admin]);
 const own=(await call(buyer,'/api/posts','POST',input('Looking to buy a working Casio fx-991CW calculator. Budget up to HKD 200.'),201)).id;ownIds.push([buyer,own]);
 await call(buyer,'/api/matches');
 const [offer]=await Promise.all([call(seller,'/api/posts','POST',input(sellerBody),201),call(buyer,'/api/matches')]);ownIds.push([seller,offer.id]);
 assert.ok(await matching(offer.id));checks.push('post creation appears immediately across route bundles, including overlapping GET');
 assert.ok(!(await call(seller,'/api/matches')).items.some(p=>p.id===offer.id));checks.push('self excluded');
 await call(buyer,`/api/posts/${offer.id}`,'PATCH',{action:'edit',...input('Selling my working Casio fx-991CW calculator. Asking HKD 80.')},409);checks.push('nonowner edit rejected');
 await call(seller,`/api/posts/${offer.id}`,'PATCH',{action:'edit',...input('Selling my working Casio fx-991CW calculator. Asking HKD 500.')});assert.ok(!await matching(offer.id));checks.push('price edit removes incompatible result immediately');
 await call(seller,`/api/posts/${offer.id}`,'PATCH',{action:'edit',...input(sellerBody)});assert.ok(await matching(offer.id));checks.push('compatible edit restores result immediately');
 await call(seller,`/api/posts/${offer.id}`,'PATCH',{action:'close'});assert.ok(!await matching(offer.id));checks.push('closed post excluded');
 await call(seller,`/api/posts/${offer.id}`,'PATCH',{action:'reopen'});assert.ok(await matching(offer.id));checks.push('reopened post indexed immediately');
 await call(admin,'/api/admin/users','PATCH',{userId:sellerUser,action:'suspend',reason:'Synthetic isolation test'});assert.ok(!await matching(offer.id));await call(seller,'/api/matches','GET',undefined,403);checks.push('suspended account hidden and access denied');
 await call(admin,'/api/admin/users','PATCH',{userId:sellerUser,action:'activate',reason:'Synthetic isolation test complete'});assert.ok(await matching(offer.id));checks.push('reactivated account eligible immediately');
 const thread=await call(buyer,'/api/conversations','POST',{postId:offer.id},201);
 await db.execute('UPDATE conversation_participants SET is_blocked=1 WHERE conversation_id=? AND user_id=?',[thread.id,sellerUser]);assert.ok(!await matching(offer.id));checks.push('peer-side block excludes candidate');
 await db.execute('UPDATE conversation_participants SET is_blocked=0 WHERE conversation_id=?',[thread.id]);
 await db.execute("UPDATE conversations SET status='blocked' WHERE id=?",[thread.id]);assert.ok(!await matching(offer.id));checks.push('blocked conversation excludes candidate');
 await db.execute("UPDATE conversations SET status='active' WHERE id=?",[thread.id]);assert.ok(await matching(offer.id));
 // Same selected category and place tag cannot override an explicitly expired route.
 const expired=(await call(seller,'/api/posts','POST',input('HKUST to Airport on 2020-01-01 at 07:30. I can drive; 2 seats available.'),201)).id;ownIds.push([seller,expired]);
 const oldNeed=(await call(buyer,'/api/posts','POST',input('HKUST to Airport on 2020-01-01 at 07:30. Need a ride for 1 person.'),201)).id;ownIds.push([buyer,oldNeed]);
 assert.ok(!await matching(expired));checks.push('explicit expired trip excluded');
 const possible=(await call(seller,'/api/posts','POST',input('Selling my Casio fx-991CW calculator, price negotiable.'),201)).id;ownIds.push([seller,possible]);assert.ok(!await matching(possible));
 const withPossible=await call(buyer,'/api/matches?possible=1');assert.ok(withPossible.items.some(row=>row.id===possible&&row.match.confidence==='possible'));checks.push('missing price appears only when possible results requested');
 await call(seller,`/api/posts/${offer.id}`,'DELETE');assert.ok(!await matching(offer.id));checks.push('removed result excluded');
 await call(buyer,`/api/posts/${own}`,'PATCH',{action:'close'});assert.equal((await call(buyer,'/api/matches')).highConfidenceCount,0);checks.push('closed own request no longer drives matching');
 const out=process.env.MATCH_EVAL_OUTPUT||'reports/match-iteration-2026-09-11/artifacts';writeFileSync(`${out}/lifecycle-summary.json`,JSON.stringify({schema,checks,passed:checks.length,method:'Actual production-build HTTP writes/reads; explicit block fixtures written only into restricted test schema'},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks},null,2));
} finally {
 for(const [owner,id] of ownIds)await call(owner,`/api/posts/${id}`,'DELETE',undefined,(await call(owner,`/api/posts/${id}`)).post.status==='removed'?404:200).catch(()=>{});
 await db.execute("UPDATE posts p JOIN users u ON u.id=p.owner_id SET p.status='removed',p.updated_at=UTC_TIMESTAMP(3) WHERE u.identity_id LIKE ?",[prefix+'-%']);
 await db.end();
}
