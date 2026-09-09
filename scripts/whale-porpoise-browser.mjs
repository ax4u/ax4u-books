import { chromium } from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { capsuleSeparation } from '../src/app/whale-flight/pod-physics.ts';
const base=process.env.BASE||'http://127.0.0.1:3241';
const out=process.env.QA_OUTPUT||'/home/hermes/.hermes/profiles/sejongchief/cache/whale-porpoise-qa/local';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
const sample=p=>p.locator('canvas').evaluate(c=>({...c.dataset}));
function check(d,viewport,first=false){
 const models=JSON.parse(d.whaleModels),porpoises=models.filter(a=>a.species==='porpoise');
 assert.equal(models.length,11);assert.deepEqual(JSON.parse(d.whaleCounts),{humpback:3,blue:3,orca:2,sperm:2,porpoise:1});
 assert.equal(porpoises.length,1);const p=porpoises[0];
 assert.equal(p.id,'porpoise-01');assert.equal(p.model,'original:finless-porpoise');assert.equal(p.bodyLength,1.8);
 assert.equal(new Set(models.map(a=>a.modeluuid)).size,11);assert.equal(d.cameraMode,'quiet-observer');assert.deepEqual(JSON.parse(d.cameraPosition),[0,0,28]);
 assert.equal(d.motionEdition,'dynamic-eleven-porpoise-v1');
 const pixelLength=viewport.height*p.bodyLength/(2*(28-p.position[2])*Math.tan(Number(d.cameraFov)*Math.PI/360));
 if(first){assert.ok(p.visible);assert.ok(Math.abs(p.screenCenter[0])<.75&&Math.abs(p.screenCenter[1])<.75);assert.ok(pixelLength>=65,`identifiable initial size: ${pixelLength}px`);}
 const bodies=models.map(a=>({spec:{length:a.colliderLength,radius:a.radius},position:new THREE.Vector3(...a.position),quaternion:new THREE.Quaternion(...a.quaternion).normalize()}));
 let minSeparation=Infinity;
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)minSeparation=Math.min(minSeparation,capsuleSeparation(bodies[i],bodies[j]).distance);
 assert.ok(minSeparation>-.005);assert.ok(28-p.position[2]>p.radius*2+2);
 for(const a of models)assert.ok([...a.position,...a.quaternion,...a.velocity,a.animationTime].every(Number.isFinite));
 return {models,porpoise:p,pixelLength,minSeparation,time:Number(d.flightTime)};
}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport,reducedMotion:'no-preference'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/whale-flight',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.flightReady==='true',{}, {timeout:60000});
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('canvas')).opacity)>.999);
  const initial=check(await sample(page),viewport,true),frames=[initial];
  assert.ok(initial.time>=0);assert.equal((await sample(page)).flightPaused,'false','default autoplay without user action');
  await page.screenshot({path:`${out}/${viewport.width}-initial.png`});
  const p=initial.porpoise,cx=(p.screenCenter[0]+1)*viewport.width/2,cy=(1-p.screenCenter[1])*viewport.height/2;
  const w=Math.min(viewport.width,Math.max(180,initial.pixelLength*1.5)),h=Math.min(viewport.height,Math.max(120,initial.pixelLength*.7));
  await page.screenshot({path:`${out}/${viewport.width}-porpoise-crop.png`,clip:{x:Math.max(0,Math.min(viewport.width-w,cx-w/2)),y:Math.max(0,Math.min(viewport.height-h,cy-h/2)),width:w,height:h}});
  for(const delta of [3,9,18]){
   await page.waitForFunction(t=>Number(document.querySelector('canvas').dataset.flightTime)>=t,initial.time+delta,{timeout:120000});
   const current=check(await sample(page),viewport);frames.push(current);
   for(const a of current.models){const before=initial.models.find(b=>b.id===a.id);assert.notDeepEqual(a.position,before.position);assert.ok(a.animationTime>before.animationTime);assert.notDeepEqual(a.motionSample,before.motionSample);}
   await page.screenshot({path:`${out}/${viewport.width}-${delta}s.png`});
  }
  await page.getByRole('button',{name:'비행 일시정지',exact:true}).click();
  const paused=await sample(page);await page.waitForTimeout(600);assert.equal((await sample(page)).whaleModels,paused.whaleModels);assert.equal((await sample(page)).flightTime,paused.flightTime);
  await page.getByRole('button',{name:'비행 재생',exact:true}).click();
  await page.waitForFunction(t=>Number(document.querySelector('canvas').dataset.flightTime)>t+.5,Number(paused.flightTime),{timeout:20000});
  assert.notEqual((await sample(page)).whaleModels,paused.whaleModels);
  results.push({viewport,autoplay:true,pauseResume:true,all11TranslateAndDeform:true,frames});await context.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/result.json',JSON.stringify({status:'PASS',base,results,errors},null,2));console.log(JSON.stringify({status:'PASS',base,viewports:results.map(r=>({viewport:r.viewport,initialPorpoise:r.frames[0].porpoise,pixelLength:r.frames[0].pixelLength,all11TranslateAndDeform:true,pauseResume:true})),errors},null,2));
}catch(e){await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(e),results,errors},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
