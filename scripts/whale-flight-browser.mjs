import { chromium } from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.env.BASE||'http://127.0.0.1:3216';
const output=process.env.QA_OUTPUT||'/home/hermes/.hermes/profiles/sejongchief/cache/whale-flight-qa/final';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];const errors=[];const failures=[];
async function contextFor(viewport,extra={}){
 const context=await browser.newContext({viewport,...extra});
 context.on('request',r=>{if(/\/whale-flight\/sangmung(?:-wink)?\.webp(?:$|\?)/.test(r.url()))failures.push('REMOVED_MASCOT_REQUEST '+r.url());});
 if(base.includes('127.0.0.1'))await context.route('**/_vercel/insights/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await context.route('**/api/**',r=>{failures.push('UNEXPECTED_API '+r.request().method()+' '+r.request().url());return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url())});return{context,page};
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.flightReady==='true',{},{timeout:45000});}
async function time(page){return Number(await page.locator('canvas').getAttribute('data-flight-time'));}
async function image(page){return createHash('sha256').update(await page.locator('canvas').evaluate(c=>c.toDataURL())).digest('hex');}
async function noOverflow(page,w){assert.ok(await page.evaluate(w=>document.documentElement.scrollWidth<=w+1,w),'page overflow '+w);const outside=await page.locator('main button,main header a').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)}).map(e=>e.textContent));assert.deepEqual(outside,[],'controls outside viewport');}
try{
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:390,height:844},{width:320,height:740},{width:844,height:390},{width:1024,height:768}]){
  const {context,page}=await contextFor(viewport);try{
   await page.goto(base+'/whale-flight',{waitUntil:'domcontentloaded'});await ready(page);
   await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.flightTime)>.45,{},{timeout:20000});
   assert.equal(await page.getByRole('heading',{name:'고래들의 비상',exact:true}).count(),1);
   await noOverflow(page,viewport.width);
   assert.equal(await page.locator('[data-wink]').count(),0);assert.doesNotMatch(await page.locator('canvas').getAttribute('aria-label'),/상멍|윙크/);assert.doesNotMatch(await page.locator('main').innerText(),/상멍|윙크/);
   const count=Number(await page.locator('canvas').getAttribute('data-whale-count'));assert.equal(count,viewport.width<720?6:10);
   await page.screenshot({path:`${output}/${viewport.width}x${viewport.height}.png`});
   await page.getByRole('button',{name:'비행 일시정지',exact:true}).click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.flightPaused==='true');
   const pausedTime=await time(page), a=await image(page);await page.waitForTimeout(450);assert.equal(await time(page),pausedTime);assert.equal(await image(page),a);
   await page.getByRole('button',{name:'비행 재생',exact:true}).click();await page.waitForFunction(t=>Number(document.querySelector('canvas').dataset.flightTime)>t+.3,pausedTime,{timeout:10000});
   if(viewport.width===1440){
    assert.notEqual(await image(page),a,'whales continue animating without a mascot');
    await page.getByRole('button',{name:'소리 켜기',exact:true}).click();assert.equal(await page.getByRole('button',{name:'소리 끄기',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'소리 끄기',exact:true}).click();
    await page.getByRole('button',{name:'전체화면',exact:true}).click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.getByRole('button',{name:'전체화면 해제',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);
    await page.getByRole('button',{name:'작품 정보',exact:true}).click();assert.match(await page.locator('#flight-credits').innerText(),/Bohdan Lvov/);assert.doesNotMatch(await page.locator('#flight-credits').innerText(),/상멍|윙크/);await page.getByRole('button',{name:'작품 정보 닫기',exact:true}).click();
    await page.getByRole('link',{name:'체험 나가기',exact:true}).click();await page.waitForURL(base+'/');assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),false);
    await page.getByRole('link',{name:'고래들의 비상 체험 열기',exact:true}).click();await ready(page);await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.getByRole('link',{name:'체험 나가기',exact:true}).click();await page.waitForURL(base+'/');
   }
   results.push({viewport,whales:count,mascotAbsent:true,pauseFreeze:true,resume:true,overflow:false});
  }finally{await context.close()}
 }
 // Reduced motion is static until the visitor explicitly opts in.
 {
  const {context,page}=await contextFor({width:390,height:844},{reducedMotion:'reduce'});try{
   await page.goto(base+'/whale-flight');await ready(page);assert.equal(await page.locator('main').getAttribute('data-paused'),'true');const t=await time(page),a=await image(page);await page.waitForTimeout(650);assert.equal(await time(page),t);assert.equal(await image(page),a);
   await page.getByRole('button',{name:'비행 시작',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.flightTime)>.3,{},{timeout:15000});results.push({reducedMotion:'PASS',explicitOptIn:'PASS'});
  }finally{await context.close()}
 }
 // Public navigation + original approved exhibition only; no private/customer APIs.
 {
  const {context,page}=await contextFor({width:1024,height:768});try{
   for(const path of ['/','/exhibition','/login']){await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.getByRole('link',{name:'고래들의 비상 ↗',exact:true}).waitFor();}
   await page.goto(base+'/exhibition/planet-friends');await page.getByRole('heading',{name:/행성 친구들의 우당당탕 여행/}).waitFor();
   results.push({publicNavigation:'PASS',bookReader:'PASS'});
  }finally{await context.close()}
 }
 assert.deepEqual(errors,[],'browser errors');assert.deepEqual(failures,[],'HTTP or unexpected API failures');
 const report={status:'PASS',base,results,errors,failures};await fs.writeFile(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){console.error(error);await fs.writeFile(output+'/failure.json',JSON.stringify({base,results,errors,failures,error:String(error)},null,2));process.exitCode=1;}finally{await browser.close()}
