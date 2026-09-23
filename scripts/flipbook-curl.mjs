import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs');
const base=process.env.TEST_BASE_URL || 'https://gobibi.art';
const out=process.env.QA_OUT || '../evidence/curl';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const failures=[],results=[];
try {
for(const viewport of (process.env.QUICK?[{width:1440,height:1000}]:[{width:1440,height:1000},{width:390,height:844},{width:844,height:390}])) {
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1,recordVideo:{dir:out,size:viewport}});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const idle=()=>page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.turning==='idle');
 const ready=()=>page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-mobile-book] img')].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 await page.goto(base+'/exhibition/'+(process.env.TEST_BOOK || 'love-treatment-epilogue'));await idle();
 for(const direction of [1,-1]) {
  await page.getByLabel('페이지 선택',{exact:true}).selectOption(direction===1?'2':'4');await ready();
  const stage=await page.locator('[data-mobile-stage]').boundingBox(),b=await page.locator('[data-mobile-book]').boundingBox();
  const x=stage.x+stage.width*(direction===1?.9:.1),y=b.y+b.height*.65;
  await page.mouse.move(x,y);await page.mouse.down();
  for(const p of [.25,.5,.75]) {
   await page.mouse.move(x-direction*Math.max(160,stage.width*.7)*p,y,{steps:12});await ready();
   const pose=await page.locator('[data-mobile-leaf]').evaluate(e=>({
    progress:Number(e.dataset.progress),transform:getComputedStyle(e).transform,
    strips:[...e.querySelectorAll('[data-curl-strip]')].map(s=>{const m=new DOMMatrix(getComputedStyle(s).transform);return {x:Number(s.dataset.x),z:Number(s.dataset.z),angle:Math.atan2(-m.m13,m.m11),transform:getComputedStyle(s).transform,tx:m.m41,tz:m.m43,width:parseFloat(getComputedStyle(s).width),normal:m.m11};}),
    faces:[...e.querySelectorAll('[data-leaf-face]')].map(f=>({face:f.dataset.leafFace,page:f.querySelector('img')?.dataset.sourcePage,hidden:getComputedStyle(f).backfaceVisibility})),
    shadow:document.querySelector('[data-curl-shadow]')?.getAttribute('style'),
    underneath:[...document.querySelectorAll('[data-visible-side] img')].map(i=>Number(i.dataset.sourcePage))
   }));
   const tag=`${viewport.width}-${direction===1?'forward':'reverse'}-${p*100}`;
   await page.screenshot({path:`${out}/${tag}.jpg`,type:'jpeg',quality:94});
   const bends=new Set(pose.strips.map(s=>s.angle.toFixed(3)));
   if(bends.size<8)failures.push(tag+': paper remains a rigid plane, no changing local tangents');
   if(pose.strips.length) {
    const first=pose.strips[0],last=pose.strips.at(-1),reverse=viewport.width>viewport.height&&direction===-1;
    const bindingX=reverse?first.tx+Math.cos(first.angle)*(first.width-1):first.tx;
    const bindingZ=reverse?first.tz-Math.sin(first.angle)*(first.width-1):first.tz;
    if(Math.abs(bindingX)>.03||Math.abs(bindingZ)>.03)failures.push(tag+': actual mesh binding detached');
    const edge=reverse?last.tx:last.tx+Math.cos(last.angle)*(last.width-1);
    const visualP=viewport.width<viewport.height&&direction===-1?1-p:p;
    if(visualP<.5&&edge*(reverse?-1:1)<=0 || visualP>.5&&edge*(reverse?-1:1)>=0)failures.push(tag+': fore-edge not carried across binding');
    pose.edge=edge;pose.binding=[bindingX,bindingZ];
    if(p===.5 && !pose.strips.some(s=>s.normal>0) || p===.5 && !pose.strips.some(s=>s.normal<0))failures.push(tag+': paper front/back normals do not bend around halfway');
   }
   if(pose.faces.some(f=>f.hidden!=='hidden'))failures.push(tag+': mirrored face exposed');
   const portrait=viewport.width<viewport.height;
   const expected=portrait?(direction===1?{front:2,back:3,under:[3]}:{front:3,back:4,under:[4]}):(direction===1?{front:3,back:4,under:[2,5]}:{front:4,back:3,under:[2,5]});
   for(const face of ['front','back'])assert.deepEqual([...new Set(pose.faces.filter(f=>f.face===face).map(f=>Number(f.page)))],[expected[face]],tag+' source '+face);
   assert.deepEqual(pose.underneath,expected.under,tag+' new page below leaf');
   if(!pose.shadow)failures.push(tag+': no progress-linked cast shadow');
   results.push({tag,pose});
  }
  await page.mouse.up();await idle();
 }
 assert.deepEqual(errors,[]);await ctx.close();
}
await fs.writeFile(out+'/curl.json',JSON.stringify({base,results,failures},null,2));console.log(JSON.stringify({base,failures,frames:results.length},null,2));assert.deepEqual(failures,[]);
}finally{await browser.close();}
