import { chromium } from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE||'http://127.0.0.1:3232';
const out=process.env.QA_OUTPUT||'/home/hermes/.hermes/profiles/sejongchief/cache/sky10-majestic-qa/rotation';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
async function sample(page,label){
 const d=await page.locator('canvas').evaluate(c=>({data:{...c.dataset},width:c.clientWidth,height:c.clientHeight}));
 const models=JSON.parse(d.data.whaleModels),xs=models.map(m=>m.screenCenter[0]);
 const span=(Math.max(...xs)-Math.min(...xs))/2;
 const sizes=models.map(m=>m.bodyLength/(2*(28-m.position[2])*Math.tan(Number(d.data.cameraFov)*Math.PI/360)*(d.width/d.height)));
 assert.equal(d.data.motionEdition,'dynamic-ten-v2');assert.equal(models.length,10);
 assert.deepEqual(JSON.parse(d.data.cameraPosition),[0,0,28]);
 // Independent curved courses can temporarily bring centers closer together.
 // The regression is resize-induced compression: frozen before/after positions
 // are checked exactly below, rather than comparing different swim times.
 if (label === 'portrait-initial') assert.ok(span>.45,`${label}: initial framing spans the view: ${span}`);
 assert.ok(xs.some(x=>x<-.2)&&xs.some(x=>x>.2),`${label}: occupy both sides`);
 assert.ok(Number(d.data.pixelRatio)>=1,'readable silhouettes, no sub-CSS-pixel buffer');
 assert.ok(Math.max(...sizes)>.30,`${label}: foreground whale is substantial, not distant dots`);
 assert.ok(Math.max(...sizes)<.85,`${label}: no screen-consuming whale`);
 await fs.writeFile(`${out}/${label}.json`,JSON.stringify(d,null,2));
 results.push({label,width:d.width,height:d.height,count:10,spanPercent:span*100,maxBroadsideLengthPercent:Math.max(...sizes)*100,time:Number(d.data.flightTime)});
 return {d,models};
}
try{
 const c=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await c.route('**/api/**',r=>{errors.push('Unexpected API');return r.abort();});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await p.goto(base+'/whale-flight',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.flightReady==='true',{},{timeout:60000});
 await sample(p,'portrait-initial');
 await p.getByRole('button',{name:'비행 시작',exact:true}).click();
 await p.waitForFunction(()=>Number(document.querySelector('canvas').dataset.flightTime)>.6,{},{timeout:30000});
 const live=await sample(p,'portrait-live');
 await p.screenshot({path:out+'/portrait.png'});
 const identities=live.models.map(m=>[m.id,m.modeluuid,m.rootuuid]);
 for(const [label,viewport]of [['landscape',{width:932,height:430}],['landscape-toolbar',{width:932,height:370}],['portrait-return',{width:430,height:932}],['desktop',{width:1440,height:900}]]){
  await p.getByRole('button',{name:'비행 일시정지',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('canvas').dataset.flightPaused==='true');
  const paused=await p.locator('canvas').evaluate(c=>({...c.dataset}));
  const before=Number(paused.flightTime),beforeModels=JSON.parse(paused.whaleModels);
  await p.setViewportSize(viewport);
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const reflow=await p.locator('canvas').evaluate(c=>({...c.dataset}));
  assert.equal(Number(reflow.flightTime),before,'reflow preserves the simulation clock');
  JSON.parse(reflow.whaleModels).forEach((m,i)=>{
    assert.ok(Math.abs(m.screenCenter[0]-beforeModels[i].screenCenter[0])<.0001,'exact horizontal reflow');
    assert.ok(Math.abs(m.screenCenter[1]-beforeModels[i].screenCenter[1])<.0001,'exact vertical reflow');
  });
  await p.getByRole('button',{name:'비행 재생',exact:true}).click();
  await p.waitForFunction(v=>{const c=document.querySelector('canvas');return c.clientWidth===v.width&&c.clientHeight===v.height&&Number(c.dataset.flightTime)>v.before+.3;},{...viewport,before},{timeout:30000});
  const current=await sample(p,label);
  assert.deepEqual(current.models.map(m=>[m.id,m.modeluuid,m.rootuuid]),identities,'resize reuses animals, no respawn');
  assert.ok(Number(current.d.data.flightTime)>before,'time never resets');
  assert.ok(current.models.every((m,i)=>m.animationTime>live.models[i].animationTime));
  await p.screenshot({path:`${out}/${label}.png`});
 }
 // Fullscreen transition in the same scene, followed by real exit.
 await p.getByRole('button',{name:'전체화면',exact:true}).click();
 await p.waitForFunction(()=>Boolean(document.fullscreenElement));
 await sample(p,'fullscreen');
 await p.getByRole('button',{name:'전체화면 해제',exact:true}).click();
 await p.waitForFunction(()=>!document.fullscreenElement);
 await sample(p,'fullscreen-exit');
 assert.deepEqual(errors,[]);
 const report={status:'PASS',base,results,errors,stableIdentities:true,continuousClock:true,exactReflowPositions:true,method:'Chromium mobile viewport emulation, not physical iOS'};
 await fs.writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 await c.close();
}catch(error){await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(error),results,errors},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
