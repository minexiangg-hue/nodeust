import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
export async function checkEmailMatchBrowser({base,cookie}) {
  assert.equal(base,'http://127.0.0.1:3104');
  assert.equal(process.env.NODE_EMAIL_TEST_MODE,'true');
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/tmp/vis/node_modules/playwright-core/index.mjs');
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',args:['--no-sandbox']});
  const out='reports/match-iteration-2026-09-19/email-browser';mkdirSync(out,{recursive:true});
  const results=[];
  try {
    for(const {name,viewport} of [{name:'desktop',viewport:{width:1365,height:900}},{name:'mobile',viewport:{width:390,height:844}}]) {
      const context=await browser.newContext({viewport});
      try {
        const split=cookie.indexOf('=');
        await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:base,httpOnly:true,sameSite:'Lax'}]);
        await context.addInitScript(()=>localStorage.setItem('node:locale','en'));
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base+'/matches',{waitUntil:'networkidle'});
        await page.waitForFunction(()=>document.querySelectorAll('.match-result-card').length===25);
        assert.ok(await page.getByText('Related posts · not confirmed matches',{exact:true}).isVisible());
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
        assert.equal(overflow,false,`${name} horizontal overflow`);
        await page.locator('.match-pagination').getByRole('button',{name:'Next',exact:true}).click();
        await page.waitForFunction(()=>document.querySelectorAll('.match-result-card').length===2);
        await page.locator('.match-pagination').getByRole('button',{name:'Previous',exact:true}).click();
        await page.waitForFunction(()=>document.querySelectorAll('.match-result-card').length===25);
        await page.reload({waitUntil:'networkidle'});
        await page.waitForFunction(()=>document.querySelectorAll('.match-result-card').length===25);
        await page.screenshot({path:`${out}/${name}.png`,fullPage:false});
        assert.deepEqual(errors,[],`${name} browser errors`);
        results.push({viewport:name,firstPage:25,secondPage:2,reload:true,horizontalOverflow:overflow,pageErrors:errors});
      } finally {await context.close();}
    }
    writeFileSync(`${out}/summary.json`,JSON.stringify({scope:'Synthetic email session, direct route, pagination, reload and viewport overflow only',results},null,2)+'\n');
  } finally {await browser.close();}
}
