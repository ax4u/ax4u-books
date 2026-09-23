import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs');
const base=process.env.TEST_BASE_URL || 'https://gobibi.art';
const out=process.env.QA_OUT || '../evidence/before';
const diagnose=process.env.DIAGNOSE==='1';
const books=JSON.parse(await fs.readFile('src/lib/exhibition/public-books.json','utf8'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const results=[],failures=[];
try{
for(const dpr of [1,2])for(const viewport of [{width:1440,height:1000},{width:844,height:390}]){
 const context=await browser.newContext({viewport,deviceScaleFactor:dpr});const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const tag=`${viewport.width}-dpr${dpr}`;
 const idle=()=>page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.turning==='idle');
 const ready=()=>page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-mobile-book] img')].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const shot=async(name)=>{await ready();await page.screenshot({path:`${out}/${tag}-${name}.jpg`,type:'jpeg',quality:94});};
 const check=(ok,message)=>{if(!ok)failures.push(`${tag}: ${message}`);};
 await page.goto(base+'/exhibition/'+books[0].slug);await idle();await page.getByLabel('페이지 선택',{exact:true}).selectOption('2');await ready();
 const geometry=()=>page.evaluate(()=>{
  const book=document.querySelector('[data-mobile-book]'), b=book.getBoundingClientRect();
  return [...document.querySelectorAll('[data-visible-side]')].map(e=>{const i=e.querySelector('img'),r=e.getBoundingClientRect(),s=getComputedStyle(e);const k=Math.min(r.width/i.naturalWidth,r.height/i.naturalHeight),w=i.naturalWidth*k,h=i.naturalHeight*k;const pos=getComputedStyle(i).objectPosition;const x=pos.startsWith('100%')?r.right-w:pos.startsWith('0%')?r.left:r.left+(r.width-w)/2;return {side:e.dataset.visibleSide,page:i.dataset.sourcePage,natural:[i.naturalWidth,i.naturalHeight],box:{x:r.x,y:r.y,width:r.width,height:r.height},drawn:{x,width:w,height:h},center:b.x+b.width/2,border:s.borderWidth,radius:s.borderRadius,position:pos,fit:getComputedStyle(i).objectFit};});
 });
 const checkGeometry=async(label)=>{const g=await geometry();results.push({tag,label,geometry:g});check(Math.abs(g[0].drawn.x+g[0].drawn.width-g[0].center)<.1,'left artwork must meet hinge without letterbox');check(Math.abs(g[1].drawn.x-g[1].center)<.1,'right artwork must meet hinge without letterbox');check(g.every(x=>x.fit==='contain'),'original artwork must not crop');};
 await checkGeometry('rest');await shot('rest');
 const spine=await page.locator('[data-mobile-book] > [aria-hidden="true"]').first().evaluate(e=>getComputedStyle(e).backgroundImage);
 results.push({tag,spine});check(!spine.includes('255, 255, 255'),'spine must not paint a white highlight line');
 // Real pointer drag: progress is determined by stage width, not simulated images.
 for(const direction of [1,-1])for(const progress of [.25,.5,.75]){
  await page.getByLabel('페이지 선택',{exact:true}).selectOption(direction===1?'2':'4');await idle();await ready();
  const stage=await page.locator('[data-mobile-stage]').boundingBox();const b=await page.locator('[data-mobile-book]').boundingBox();
  const x=direction===1?stage.x+stage.width*.85:stage.x+stage.width*.15,y=b.y+b.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-direction*Math.max(160,stage.width*.7)*progress,y,{steps:8});await ready();
  const leaf=page.locator('[data-mobile-leaf]');assert.equal(await leaf.count(),1);
  const pose=await leaf.evaluate(e=>({transform:getComputedStyle(e).transform,origin:getComputedStyle(e).transformOrigin,strips:[...e.querySelectorAll('[data-curl-strip]')].map(s=>getComputedStyle(s).transform),faces:[...e.querySelectorAll('[data-leaf-face]')].map(f=>({transform:getComputedStyle(f).transform,page:f.querySelector('img')?.dataset.sourcePage,backface:getComputedStyle(f).backfaceVisibility}))}));
  results.push({tag,direction,progress,pose});
  check(pose.strips.length>8 && pose.strips.every(t=>{const m=t.match(/matrix3d\((.*)\)/)?.[1].split(',').map(Number);return m && Math.abs(m[5]-1)<.00001;}),'deformed paper preserves full-height binding without whole-page scaling');
  check(new Set(pose.strips).size>8,'paper deforms rather than rotating one rigid plane');
  const bounds=await leaf.boundingBox();
  check(Math.abs(bounds.y-b.y)<.2 && Math.abs(bounds.height-b.height)<.2,'turning sheet hinge stays attached at top and bottom');
  check(pose.faces.every(f=>f.backface==='hidden'),'both paper faces hide their mirrored reverse');
  await shot(`${direction===1?'forward':'reverse'}-${progress*100}`);
  await page.mouse.up();await idle();
 }
 await page.getByLabel('페이지 선택',{exact:true}).selectOption('2');await page.getByLabel('확대',{exact:true}).click();await checkGeometry('zoom125');await shot('zoom125');await page.getByLabel('배율 초기화',{exact:true}).click();
 await page.setViewportSize({width:viewport.width-17,height:viewport.height-13});await ready();await checkGeometry('fractional-resize');await shot('resize');
 check(errors.length===0,'no runtime errors: '+errors.join(';'));await context.close();
}
await fs.writeFile(`${out}/seam.json`,JSON.stringify({base,diagnose,results,failures},null,2));
console.log(JSON.stringify({base,failures,scenarios:results.length},null,2));if(!diagnose)assert.deepEqual(failures,[]);
}finally{await browser.close();}
