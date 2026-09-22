import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs');
const base = process.env.TEST_BASE_URL || 'https://gobibi.art';
const out = process.env.QA_OUT || '/home/hermes/.hermes/profiles/devstandard/cache/flipbook-before';
await fs.mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', headless:true,args:['--no-sandbox']});
const errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror', e=>errors.push(e.message));
async function shot(name) {
 await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
}
try {
 await page.goto(base,{waitUntil:'networkidle'});
 const menu=page.getByRole('link',{name:/전시/}).first();
 await menu.click();
 await page.waitForURL('**/exhibition');
 await page.locator('a[aria-label$="그림책 펼치기"]').first().waitFor();
 const links=await page.locator('a[aria-label$="그림책 펼치기"]').evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label'),href:e.getAttribute('href')})));
 await fs.writeFile(`${out}/catalog.json`,JSON.stringify(links,null,2));
 assert.ok(links.length>0);
 await page.locator('a[aria-label$="그림책 펼치기"]').first().click();
 await page.waitForURL('**/exhibition/*');
 await page.getByRole('dialog').waitFor({timeout:10000});
 await shot('desktop-cover');
 assert.equal(await page.getByRole('dialog').count(),1,'PC menu/book click must open immersive flipbook with close and fullscreen controls');
 await page.getByRole('button',{name:'뷰어 닫기',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'전체화면',exact:true}).count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS desktop exhibition menu -> actual immersive reader',page.url());
} catch(e) {await fs.writeFile(`${out}/failure.txt`,e.stack+'\n'+JSON.stringify(errors));throw e;}
finally {await browser.close();}
