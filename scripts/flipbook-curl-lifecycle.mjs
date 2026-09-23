import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import('/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs');
const base=process.env.TEST_BASE_URL||'http://localhost:3239',out=process.env.QA_OUT||'../evidence/lifecycle';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=page.locator('[data-mobile-reader]');
const idle=()=>page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.turning==='idle');
const current=async n=>assert.equal(await root.getAttribute('data-current-page'),String(n));
const select=async n=>{await idle();await page.getByLabel('페이지 선택',{exact:true}).selectOption(String(n));};
async function touch(type,x,y){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});}
async function startTouch(dx=-160,dy=0){const b=await page.locator('[data-mobile-book]').boundingBox();const x=dx<0?340:50,y=b.y+b.height*.6;await touch('touchStart',x,y);for(let n=1;n<=8;n++)await touch('touchMove',x+dx*n/8,y+dy*n/8);}
try {
 await page.goto(base+'/exhibition/mom-dreamed-grownup');await root.waitFor();await select(2);
 await startTouch();await page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.turning==='dragging');
 await page.screenshot({path:out+'/touch-mid.png'});await touch('touchEnd');await idle();await current(3);
 await startTouch(160);await touch('touchEnd');await idle();await current(2);checks.push('real CDP touch forward/reverse');
 await startTouch(-20);await touch('touchEnd');await idle();await current(2);
 await startTouch(4,100);await touch('touchEnd');await idle();await current(2);
 await startTouch();await touch('touchCancel');await idle();await current(2);checks.push('real touch short/vertical/cancel');
 await startTouch();await page.setViewportSize({width:844,height:390});await touch('touchEnd');await idle();await current(2);assert.equal(await root.getAttribute('data-layout'),'landscape');checks.push('rotation during touch drag aborts without page loss');
 await page.evaluate(()=>{const b=document.querySelector('button[aria-label="다음 페이지"]');b.click();b.click();});await idle();await current(4);checks.push('synchronous repeated next locked to one spread');
 await select(2);await page.getByLabel('다음 페이지',{exact:true}).click();await page.setViewportSize({width:390,height:844});await idle();await current(2);checks.push('rotation during settling cancels');
 await select(2);await page.evaluate(()=>{document.querySelector('button[aria-label="다음 페이지"]').click();document.querySelector('button[aria-label="뷰어 닫기"]').click();});await page.getByRole('button',{name:'전체뷰로 이어 읽기'}).click();await idle();await current(2);checks.push('close during settling preserves committed page');
 await startTouch();await page.emulateMedia({reducedMotion:'reduce'});await touch('touchEnd');await idle();await current(2);assert.equal(await page.locator('[data-mobile-leaf]').count(),0);
 await page.getByLabel('다음 페이지',{exact:true}).click();await idle();await current(3);checks.push('motion preference change cancels then navigates without animated mesh');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByLabel('컨트롤 접기',{exact:true}).click();await startTouch();await touch('touchEnd');await idle();await current(4);await page.getByLabel('컨트롤 펼치기',{exact:true}).click();checks.push('collapsed controls retain touch navigation');
 await select(6);await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-mobile-book] img')].map(i=>i.decode()));});await startTouch(-205);await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-mobile-book] img')].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.screenshot({path:out+'/readable-text-curl.png'});await touch('touchEnd');await idle();
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/lifecycle.json',JSON.stringify({base,checks,errors},null,2));console.log('PASS',checks);
}finally{await browser.close();}
