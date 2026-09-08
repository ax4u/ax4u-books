import {chromium} from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE||'http://127.0.0.1:3216';
const out=process.env.QA_OUTPUT||'/home/hermes/.hermes/profiles/sejongchief/cache/whale-flight-qa/final';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 // Simulate a lost model request, then verify the actual retry remounts and renders.
 const c=await browser.newContext({viewport:{width:390,height:844}});const p=await c.newPage();
 await c.route('**/blue-whale.glb',r=>r.fulfill({status:503,body:'Temporary test failure'}));
 await p.goto(base+'/whale-flight');await p.getByRole('heading',{name:'하늘을 열지 못했어요.'}).waitFor({timeout:20000});await p.screenshot({path:out+'/model-failure.png'});
 await c.unroute('**/blue-whale.glb');await p.getByRole('button',{name:'다시 시도',exact:true}).click();await p.waitForFunction(()=>document.querySelector('canvas').dataset.flightReady==='true',{},{timeout:30000});results.push('model failure and real retry PASS');
 await p.evaluate(()=>{window.oldFlightCanvas=document.querySelector('canvas')});await p.getByRole('link',{name:'체험 나가기',exact:true}).click();await p.waitForURL(base+'/');
 await p.waitForFunction(()=>!window.oldFlightCanvas.isConnected && window.oldFlightCanvas.dataset.flightReady==='false',{},{timeout:10000});const t=await p.evaluate(()=>window.oldFlightCanvas.dataset.flightTime);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>window.oldFlightCanvas.dataset.flightTime),t);results.push('route exit disposes old scene PASS');await c.close();
 // Explicitly unavailable WebGL. This is a simulated compatibility test, not a real device claim.
 const noGl=await browser.newContext({viewport:{width:390,height:844}});await noGl.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.call(this,type,...args)}});const q=await noGl.newPage();await q.goto(base+'/whale-flight');await q.getByRole('heading',{name:'하늘을 열지 못했어요.'}).waitFor({timeout:15000});await q.screenshot({path:out+'/webgl-unavailable.png'});results.push('simulated WebGL unavailable fallback PASS');await noGl.close();
 const noFs=await browser.newContext({viewport:{width:390,height:844}});await noFs.addInitScript(()=>{Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{value:undefined,configurable:true})});const f=await noFs.newPage();await f.goto(base+'/whale-flight');await f.waitForFunction(()=>document.querySelector('canvas').dataset.flightReady==='true',{},{timeout:30000});await f.getByRole('button',{name:'전체화면',exact:true}).click();await f.getByText('이 브라우저는 전체화면 전환을 지원하지 않아 화면 맞춤 모드로 보여드립니다.',{exact:true}).waitFor();assert.equal(await f.evaluate(()=>Boolean(document.fullscreenElement)),false);results.push('simulated fullscreen unavailable CSS fallback PASS');await noFs.close();
 console.log(JSON.stringify({status:'PASS',results}));await fs.writeFile(out+'/failure-modes.json',JSON.stringify({status:'PASS',base,results},null,2));
}finally{await browser.close()}
