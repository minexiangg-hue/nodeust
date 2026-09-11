import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/vis/node_modules/playwright-core/index.mjs');
const out=resolve(process.env.MATCH_STUDY_OUTPUT||'reports/match-study-2026-09-11/artifacts');
assert.equal(process.env.NODE_TEST_BASE_URL,'http://127.0.0.1:3102');assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/nodeust_matchstudy_[a-f0-9]{8}$/);
const roles=readFileSync(out+'/roles.jsonl','utf8').trim().split('\n').map(JSON.parse);const posts=new Map(readFileSync(out+'/posts.jsonl','utf8').trim().split('\n').map(line=>{const p=JSON.parse(line);return [p.id,p];}));
writeFileSync(out+'/browser-log.jsonl','');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',args:['--no-sandbox']});
let cursor=0,completed=0;const results=[];
try{await Promise.all(Array.from({length:4},async()=>{
 while(cursor<roles.length){const i=cursor++;const role=roles[i];const mobile=i%2===0;const width=mobile?390:1440;
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:mobile,isMobile:mobile,extraHTTPHeaders:{'x-hkust-uid':role.studentId,'x-hkust-email':role.studentId+'@connect.ust.hk','x-node-proxy-secret':process.env.NODE_TRUSTED_PROXY_SECRET}});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],httpFailures=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)httpFailures.push({url:new URL(r.url()).pathname,status:r.status()});});
 try{
  const feedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/posts'&&r.request().method()==='GET');
  const profileResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/profile'&&r.request().method()==='GET');
  await page.goto(process.env.NODE_TEST_BASE_URL+'/matches');
  const [feed,profile]=await Promise.all([(await feedResponse).json(),(await profileResponse).json()]);assert.equal(profile.profile.role,'member');
  assert.deepEqual(feed.items.map(p=>p.id),role.feed.map(p=>p.id));
  const expected=role.algorithms['current-feed'].returned;
  await page.waitForFunction(count=>document.querySelectorAll('.community-app .request-row').length===count,expected.length);
  if(!expected.length)await page.getByText('No reciprocal housing matches yet',{exact:true}).waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const actual=await page.locator('.community-app .request-row').evaluateAll(rows=>rows.map(row=>({title:row.querySelector('strong')?.textContent,body:row.querySelector('p')?.textContent})));
  assert.deepEqual(actual,expected.map(id=>({title:posts.get(id).payload.title,body:posts.get(id).payload.body})));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);
  if(expected.length||i===0)await page.screenshot({path:out+`/browser-${role.studentId}.png`,fullPage:true});
  const result={studentId:role.studentId,width,expectedIds:expected,observed:actual,passed:true,runtimeErrors:errors,httpFailures};results.push(result);appendFileSync(out+'/browser-log.jsonl',JSON.stringify(result)+'\n');
 }catch(error){appendFileSync(out+'/browser-log.jsonl',JSON.stringify({studentId:role.studentId,passed:false,error:error.message,errors,httpFailures})+'\n');throw error;}finally{await context.close();}
 if(++completed%50===0)console.log(`Browser verified ${completed}/500 roles`);
 }
}));}finally{await browser.close();}
writeFileSync(out+'/browser-summary.json',JSON.stringify({roles:results.length,passed:results.filter(r=>r.passed).length,mobile:results.filter(r=>r.width===390).length,desktop:results.filter(r=>r.width===1440).length,method:'Real authenticated isolated API; no API mocks; UI text and count compared with logged predictions.'},null,2));
