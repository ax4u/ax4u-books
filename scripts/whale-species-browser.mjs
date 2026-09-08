import { chromium } from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import * as THREE from 'three';
import { PodSimulation, capsuleSeparation } from '../src/app/whale-flight/pod-physics.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE||'http://127.0.0.1:3224';
const output=process.env.QA_OUTPUT||'/home/hermes/.hermes/profiles/sejongchief/cache/sky100-qa/final-pod';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[],requests=[],snapshots=[];
const expected={blue:20,humpback:20,sperm:20,orca:20,porpoise:20};
async function sample(page){return page.locator('canvas').evaluate(c=>({...c.dataset}));}
function check(d){
 const a=JSON.parse(d.whaleModels),depth=JSON.parse(d.depthRange),counts=JSON.parse(d.whaleCounts);
 assert.equal(a.length,100);assert.deepEqual(counts,expected);assert.equal(d.speciesCount,'5');assert.equal(new Set(a.map(x=>x.modeluuid)).size,100);assert.equal(new Set(a.map(x=>x.rootuuid)).size,100);
 assert.ok(depth[1]-depth[0]>350,'deep spatial volume');
 for(const x of a){assert.ok(x.motionSample.length>0);assert.ok(x.activitySamples>=10);assert.ok(x.colliderLength>=x.visualExtent+2*x.radius-.00001);assert.ok([...x.position,...x.quaternion,...x.velocity,x.animationTime].every(Number.isFinite));}
 const bodies=a.map(x=>({spec:{id:x.id,species:x.species,length:x.colliderLength,radius:x.radius,mass:x.mass,speed:x.baseSpeed},position:new THREE.Vector3(...x.position),velocity:new THREE.Vector3(...x.velocity),quaternion:new THREE.Quaternion(...x.quaternion).normalize()}));
 let separation=Infinity;
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)separation=Math.min(separation,capsuleSeparation(bodies[i],bodies[j]).distance);
 assert.ok(separation>-.005,`rendered pose capsules overlap ${separation}`);
 return{animals:a,bodies,separation,visible:a.filter(x=>x.visible).length};
}
try{
 for(const viewport of[{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});if(base.includes('127.0.0.1'))await context.route('**/_vercel/insights/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  context.on('request',r=>{if(r.url().endsWith('.glb'))requests.push({width:viewport.width,url:r.url()})});
  await context.route('**/api/**',r=>{errors.push('UNEXPECTED_API '+r.request().url());return r.abort()});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base+'/whale-flight',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.flightReady==='true',{},{timeout:60000});
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('canvas')).opacity)>.999,{},{timeout:10000});
  assert.equal(await page.locator('[data-species], [data-view="compare"], [data-whale-label]').count(),0);assert.doesNotMatch(await page.locator('main').innerText(),/크기 비교|유명한 종|자동 소개|대왕고래|상괭이/);
  const before=await sample(page),start=check(before);assert.ok(start.visible>=75,'initial wide view uses the full depth');
  await page.screenshot({path:`${output}/${viewport.width}x${viewport.height}-wide.png`});
  snapshots.push({viewport,phase:'wide',dataset:before});
  await page.getByRole('button',{name:'비행 시작',exact:true}).click();
  const wall=Date.now();await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.flightTime)>10,{},{timeout:75000});
  const during=await sample(page),mid=check(during),eye=JSON.parse(during.heroEye);
  await fs.writeFile(output+`/${viewport.width}x${viewport.height}-close-diagnostic.json`,JSON.stringify({viewport,eye,dataset:during},null,2));
  await page.screenshot({path:`${output}/${viewport.width}x${viewport.height}-close-diagnostic.png`});
  assert.ok(Number(during.cameraBlend)>.95);assert.ok(eye.diameterPixels>viewport.height*.12,'actual eye fills a substantial fraction of this viewport');assert.ok(Math.abs(eye.point[0])<.08&&Math.abs(eye.point[1])<.08,'actual eye at lens center');
  assert.ok(mid.animals.every((x,i)=>JSON.stringify(x.position)!==JSON.stringify(start.animals[i].position)),'all 100 positions advanced');
  assert.ok(mid.animals.every((x,i)=>x.animationTime>start.animals[i].animationTime),'all 100 animations advanced');
  for(const species of Object.keys(expected))assert.ok(mid.animals.filter(x=>x.species===species).some(x=>JSON.stringify(x.motionSample)!==JSON.stringify(start.animals.find(y=>y.id===x.id).motionSample)),species+' bone deforms');
  await page.getByRole('button',{name:'비행 일시정지',exact:true}).click();await page.screenshot({path:`${output}/${viewport.width}x${viewport.height}-eye.png`});
  snapshots.push({viewport,phase:'eye',dataset:await sample(page)});
  const fps=(Number(during.flightFrames)-Number(before.flightFrames))/((Date.now()-wall)/1000);
  if(viewport.width===1440){
   const sim=new PodSimulation(start.bodies.map(x=>x.spec),42721);let minSeparation=Infinity;const modes=new Set(),t0=performance.now();
   for(let tick=0;tick<60*120;tick++){
    sim.step(1/60);for(const x of sim.bodies)modes.add(x.mode);
    if(tick%60===0)for(let i=0;i<100;i++)for(let j=i+1;j<100;j++)minSeparation=Math.min(minSeparation,capsuleSeparation(sim.bodies[i],sim.bodies[j]).distance);
   }
   assert.ok(minSeparation>-.005);assert.ok(sim.stats.avoidances>0);assert.ok(sim.stats.collisions>0);assert.ok(sim.stats.impulse>0);assert.deepEqual([...modes].sort(),['school','solo','sprint']);
   const physics={status:'PASS',simulationSeconds:sim.time,wallMilliseconds:performance.now()-t0,actualRenderedModelSpecs:true,minSeparation,stats:sim.stats,modes:[...modes]};
   await fs.writeFile(output+'/actual-specs-120s-physics.json',JSON.stringify(physics,null,2));
   console.log(JSON.stringify({physics}));
  }
  results.push({viewport,count:100,counts:expected,all100Move:true,all100Animate:true,all5SpeciesDeform:true,initialVisible:start.visible,depth:JSON.parse(before.depthRange),separationWide:start.separation,separationClose:mid.separation,eyePixels:eye.diameterPixels,softwareWebGLFps:fps,drawCalls:Number(before.drawCalls),triangles:Number(before.triangles),textures:Number(before.textures),geometries:Number(before.geometries)});
  await fs.writeFile(output+'/snapshots.json',JSON.stringify(snapshots));await context.close();
 }
 for(const width of[1440,390,844]){const req=requests.filter(r=>r.width===width);assert.equal(req.length,4);assert.equal(new Set(req.map(r=>r.url)).size,4);assert.ok(req.every(r=>/\/(blue-whale|humpback-whale|sperm-whale|orca)\.glb$/.test(r.url)));}
 assert.deepEqual(errors,[]);const report={status:'PASS',base,results,requests,errors};await fs.writeFile(output+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await fs.writeFile(output+'/failure.json',JSON.stringify({base,error:String(error),stack:error.stack,results,errors,requests},null,2));console.error(error);process.exitCode=1;}finally{await browser.close()}
