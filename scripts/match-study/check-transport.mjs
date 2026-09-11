import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/tmp/vis/node_modules/playwright-core/index.mjs');
const base='http://127.0.0.1:3102';
assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/nodeust_matchstudy_[a-f0-9]{8}$/);
const headers=who=>({'content-type':'application/json','x-hkust-uid':'transport-qa-'+who,'x-hkust-email':`transport-qa-${who}@connect.ust.hk`,'x-node-proxy-secret':process.env.NODE_TRUSTED_PROXY_SECRET});
async function api(who,path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:headers(who),body:body?JSON.stringify(body):undefined});assert.equal(r.status,status,`${method} ${path}`);return r.json();}
await api('a','/api/profile');await api('b','/api/profile');
const values={category:'transport',title:'Share a taxi to Hang Hau',body:'Leaving campus on Friday at 18:00, looking for one person to share.',locationId:'ug-hall-i'};
const post=await api('a','/api/posts','POST',values,201);
await api('a','/api/posts','POST',{...values,category:'goods',title:'Campus desk lamp'},201);
let filtered=(await api('b','/api/posts?category=transport')).items;assert.equal(filtered.length,1);assert.equal(filtered[0].id,post.id);assert.equal(filtered[0].currentHall,null);
await api('b',`/api/posts/${post.id}`,'PATCH',{...values,action:'edit'},409);
await api('a',`/api/posts/${post.id}`,'PATCH',{...values,action:'edit',title:'Share a taxi to Hang Hau — updated'});
assert.equal((await api('a','/api/posts?mine=1&category=transport')).items.length,1);
console.log('PASS real API: create/read/filter/edit and ownership, no housing fields required.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',args:['--no-sandbox']});
const results=[];
try{for(const width of [320,390,844,1440])for(const locale of ['en','zh-CN','zh-HK']){
 await api('a','/api/profile','PATCH',{preferredLanguage:locale});
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1000,isMobile:width<1000,extraHTTPHeaders:headers('a')});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/explore');
 const label=locale==='en'?'Transport':'交通';const filters=page.locator('.explore-categories');await filters.getByRole('button',{name:label,exact:true}).click();
 assert.equal(await filters.locator('button').count(),6);
 await page.reload();await page.waitForFunction(label=>[...document.querySelectorAll('.explore-categories button.active')].some(el=>el.textContent.trim()===label),label);
 assert.ok(await filters.getByRole('button',{name:label,exact:true}).isVisible());
 const boxes=await filters.locator('button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 assert.ok(boxes.every(r=>r.x>=0&&r.right<=width+1));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!(boxes[i].x<boxes[j].right&&boxes[i].right>boxes[j].x&&boxes[i].y<boxes[j].bottom&&boxes[i].bottom>boxes[j].y));
 await page.goto(base+'/posts/new');await page.locator('#post-category').click();await page.getByRole('option',{name:label,exact:true}).click();assert.equal(await page.locator('#post-from').count(),0);
 await page.locator('#post-title').fill('Airport trip');await page.locator('#post-detail').fill('Two students sharing a taxi on Friday evening.');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 if(locale==='en'&&(width===390||width===1440))await page.screenshot({path:`/tmp/nodeust-transport-${width}.png`,fullPage:true});
 results.push({width,locale,categoryButtons:6,overflow:false,runtimeErrors:0});await context.close();
 console.log(`PASS UI ${width}px ${locale}: wrap, filter persistence, editor.`);
}}finally{await browser.close();}
writeFileSync('/tmp/nodeust-transport-ui-results.json',JSON.stringify(results,null,2));
