import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs');
const base=process.env.TEST_BASE_URL || 'http://localhost:3217';
const out=process.env.QA_OUT || '/home/hermes/.hermes/profiles/devstandard/cache/flipbook-local';
const books=JSON.parse(await fs.readFile('src/lib/exhibition/public-books.json','utf8'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const errors=[], checks=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
const root=page.locator('[data-mobile-reader]');
const idle=()=>page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.turning==='idle');
async function ready(){await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('[data-mobile-book] img')].map(i=>i.decode())); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function shot(name){await ready();await page.screenshot({path:`${out}/${name}.png`});}
async function select(p){await idle();await page.getByLabel('페이지 선택',{exact:true}).selectOption(String(p));await idle();await ready();}
async function current(p){assert.equal(await root.getAttribute('data-current-page'),String(p));}
async function drag(dx,dy=0,release=true){const b=await page.locator('[data-mobile-book]').boundingBox();const x=b.x+b.width*.75,y=b.y+b.height*.55;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});if(release)await page.mouse.up();}
try {
 await page.goto(base+'/exhibition/'+books[0].slug);await root.waitFor();await ready();
 assert.equal(await page.getByLabel('확대',{exact:true}).count(),1,'immersive reader must expose zoom');
 const before=await page.locator('[data-mobile-book]').boundingBox();
 await page.getByLabel('확대',{exact:true}).click();
 const after=await page.locator('[data-mobile-book]').boundingBox();assert.ok(after.width>before.width,'zoom increases actual image size');
 await page.getByLabel('배율 초기화',{exact:true}).click();
 checks.push('zoom and reset');
 await shot('desktop-cover');
 await page.getByLabel('다음 페이지',{exact:true}).click();await idle();await current(1);
 await page.getByLabel('다음 페이지',{exact:true}).click();await idle();await current(2);
 await shot('desktop-spread');
 await drag(-260,0,false);
 assert.equal(await root.getAttribute('data-turning'),'dragging');
 const leaf=page.locator('[data-mobile-leaf]');assert.equal(await leaf.count(),1);
 assert.match(await leaf.evaluate(e=>getComputedStyle(e).transform),/^matrix3d/);
 assert.equal(await leaf.locator('[data-leaf-face="front"] img').getAttribute('data-source-page'),'3');
 assert.equal(await leaf.locator('[data-leaf-face="back"] img').getAttribute('data-source-page'),'4');
 for(const face of await leaf.locator('[data-leaf-face]').all())assert.equal(await face.evaluate(e=>getComputedStyle(e).backfaceVisibility),'hidden');
 const stage=await page.locator('[data-mobile-stage]').boundingBox(), bb=await leaf.boundingBox();
 assert.ok(bb.y>=stage.y-1 && bb.y+bb.height<=stage.y+stage.height+1,'mid-turn paper must remain inside reading stage');
 await shot('desktop-drag-midpoint');await page.mouse.up();await idle();await current(4);
 await page.getByLabel('이전 페이지',{exact:true}).click();await idle();await current(2);
 await drag(-20);await idle();await current(2);
 await drag(4,110);await idle();await current(2);
 await drag(-240,0,false);await page.locator('[data-mobile-stage]').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});await page.mouse.up();await idle();await current(2);
 checks.push('forward/reverse, continuous drag, short/vertical/cancel, double-sided nonmirrored leaf, midpoint bounds');
 await page.getByLabel('뷰어 닫기',{exact:true}).click();assert.equal(await root.count(),0);
 assert.equal(await page.getByRole('button',{name:'전체뷰로 이어 읽기'}).evaluate(e=>e===document.activeElement),true);
 await page.getByRole('button',{name:'전체뷰로 이어 읽기'}).click();await current(2);
 await page.evaluate(()=>Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:false}));
 await page.getByLabel('전체화면',{exact:true}).click();await page.getByText('이 브라우저에서는 주소창을 숨길 수 없어 화면 안 전체뷰로 읽어요.').waitFor();
 await page.getByLabel('컨트롤 펼치기',{exact:true}).click();
 checks.push('close/reopen preserves page and restores focus; unsupported fullscreen fallback');
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const book of books){
  await page.goto(base+'/exhibition/'+book.slug);await root.waitFor();
  assert.equal(await page.getByLabel('페이지 선택',{exact:true}).locator('option').count(),book.pages.length);
  for(let i=0;i<book.pages.length;i++){
   await select(i);
   const imgs=page.locator('[data-visible-side] img');
   const actual=await imgs.evaluateAll(es=>es.map(e=>Number(e.dataset.sourcePage)));
   const expected=i<2?[i]:[i-i%2,i-i%2+1].filter(p=>p<book.pages.length);
   assert.deepEqual(actual,expected);
   for(const img of await imgs.all())assert.equal(await img.evaluate(e=>e.complete&&e.naturalWidth>0&&getComputedStyle(e).objectFit==='contain'&&getComputedStyle(e).transform==='none'),true);
  }
  assert.equal(await page.getByLabel('다음 페이지',{exact:true}).isDisabled(),true);
  await shot(book.slug+'-last');
 }
 checks.push('all existing catalog source pages reachable in order, contain/no image transform, last boundary');
 await select(3);await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.layout==='portrait');await ready();await current(3);
 assert.equal(await page.locator('[data-visible-side] img').count(),1);await shot('mobile-portrait');
 await page.getByLabel('다음 페이지',{exact:true}).click();await idle();await current(4);
 await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.layout==='landscape');await ready();await current(4);
 assert.deepEqual(await page.locator('[data-visible-side] img').evaluateAll(es=>es.map(e=>+e.dataset.sourcePage)),[4,5]);await shot('mobile-landscape');
 await page.setViewportSize({width:320,height:640});await page.waitForFunction(()=>document.querySelector('[data-mobile-reader]')?.dataset.layout==='portrait');await ready();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await shot('mobile-small');
 await page.getByLabel('뷰어 닫기',{exact:true}).click();await page.getByRole('button',{name:'전체뷰로 이어 읽기'}).click();await current(4);
 await page.keyboard.press('Home');await current(0);assert.equal(await page.getByLabel('이전 페이지',{exact:true}).isDisabled(),true);
 await page.keyboard.press('End');await current(books.at(-1).pages.length-1);
 checks.push('portrait single / landscape facing pages / rotation position / 320px controls / reduced-motion / Home-End');
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${out}/interactions.json`,JSON.stringify({base,checks,errors},null,2));console.log('PASS',checks);
} catch(e){await page.screenshot({path:`${out}/interaction-failure.png`});await fs.writeFile(`${out}/interaction-failure.txt`,e.stack+'\n'+JSON.stringify(errors));throw e;}finally{await browser.close();}
