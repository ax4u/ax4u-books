import { chromium } from '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE||'http://127.0.0.1:3220';const out=process.env.QA_OUTPUT||'/home/hermes/.hermes/profiles/sejongchief/cache/whale-ten-qa/species';await fs.mkdir(out,{recursive:true});
const ids=['blue','fin','sperm','humpback','gray','minke','orca','narwhal','beluga','bottlenose'];const lengths=[24,21,16,14.5,14,8.5,7,4.5,4,3];
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];const reports=[];
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport});if(base.includes('127.0.0.1'))await context.route('**/_vercel/insights/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await context.route('**/api/**',r=>{errors.push('Unexpected API '+r.request().url());return r.abort()});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await p.goto(base+'/whale-flight');await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.flightReady==='true',{},{timeout:45000});
  const stats=()=>p.locator('canvas').evaluate(c=>JSON.parse(c.dataset.whaleModels));
  const a=await stats();await p.waitForFunction(()=>Number(document.querySelector('canvas').dataset.flightTime)>1.5,{},{timeout:30000});const b=await stats();
  assert.deepEqual(a.map(w=>w.id),ids);assert.equal(new Set(a.map(w=>w.model)).size,10);
  const motion=b.map((w,i)=>{assert.ok(Math.abs(w.bodyLength-lengths[i])<.01);assert.ok(w.animationTime>a[i].animationTime);assert.notDeepEqual(w.motionSample,a[i].motionSample,w.id+' actual bones/vertices must animate');return{id:w.id,length:w.bodyLength,animated:true,model:w.model}});
  const prefix=viewport.width+'x'+viewport.height;
  await p.getByRole('button',{name:'크기 비교',exact:true}).click();await p.waitForFunction(()=>document.querySelector('canvas').dataset.viewMode==='compare');const frame=Number(await p.locator('canvas').getAttribute('data-flight-frames'));await p.waitForFunction(f=>Number(document.querySelector('canvas').dataset.flightFrames)>f+1,frame,{timeout:20000});
  await p.screenshot({path:out+'/'+prefix+'-compare.png'});
  const compared=await stats();const comparisonWidth=Number(await p.locator('canvas').getAttribute('data-comparison-width'));
  for(const whale of compared){const ratio=(whale.renderBox.max[0]-whale.renderBox.min[0])*comparisonWidth/(2*whale.bodyLength);assert.ok(ratio>(whale.id==='narwhal'?1.25:.72)&&ratio<(whale.id==='narwhal'?1.9:1.2),`${whale.id}: visible animated body must retain reference scale (${ratio})`);assert.ok(whale.renderBox.min[0]>-1&&whale.renderBox.max[0]<1,whale.id+' comparison horizontal clipping');}
  const labels=await p.locator('[data-whale-labels] [data-species]').evaluateAll(es=>es.map(e=>({id:e.dataset.species,text:e.textContent,y:e.getBoundingClientRect().y,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,bottom:e.getBoundingClientRect().bottom})));
  assert.equal(labels.length,10);for(const l of labels)assert.ok(l.y>=0 && l.bottom<=viewport.height && l.left>=0 && l.right<=viewport.width,'comparison label fits '+l.id);
  await p.getByRole('button',{name:'유명한 종 먼저',exact:true}).click();const familiar=await p.locator('button[data-species]').evaluateAll(es=>es.map(e=>e.dataset.species));assert.deepEqual(familiar,['blue','humpback','sperm','orca','beluga','narwhal','bottlenose','fin','gray','minke']);
  await p.getByRole('button',{name:'크기순',exact:true}).click();assert.deepEqual(await p.locator('button[data-species]').evaluateAll(es=>es.map(e=>e.dataset.species)),ids);
  await p.getByRole('button',{name:'자유비행',exact:true}).click();
  for(const id of ids){const button=p.locator(`button[data-species="${id}"]`);await button.scrollIntoViewIfNeeded();await button.click();await p.waitForFunction(id=>document.querySelector('canvas').dataset.activeSpecies===id,id);assert.equal(await p.locator('[data-active-card]').getAttribute('data-active-card'),id);const frame=Number(await p.locator('canvas').getAttribute('data-flight-frames'));await p.waitForFunction(f=>Number(document.querySelector('canvas').dataset.flightFrames)>f+1,frame,{timeout:20000});if(viewport.width===1440 || ['orca','beluga','humpback'].includes(id))await p.screenshot({path:out+'/'+prefix+'-'+id+'.png'});}
  if(viewport.width===1440 && !process.env.SKIP_AUTOPLAY){await p.locator('button[data-species="blue"]').click();try{await p.waitForFunction(()=>document.querySelector('canvas').dataset.activeSpecies==='fin',{},{timeout:45000});}catch(e){await fs.writeFile(out+'/autoplay-debug.json',JSON.stringify(await p.locator('canvas').evaluate(c=>({...c.dataset})),null,2));throw e;}}
  reports.push({viewport,motion,labels,selection:'10/10',sizeOrder:true,familiarOrder:true});await context.close();
 }
 assert.deepEqual(errors,[]);const report={status:'PASS',base,reports,errors};await fs.writeFile(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(error),errors,reports},null,2));console.error(error);process.exitCode=1}finally{await browser.close()}
