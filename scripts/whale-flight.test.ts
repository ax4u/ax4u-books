import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pageSocialMetadata, SHARE_IMAGE } from '../src/lib/site-metadata';

const read = (path: string) => readFileSync(path, 'utf8');
test('licensed GLB is nonempty, byte-verified and has skeletal Swimming animation', () => {
 const bytes=readFileSync('public/whale-flight/blue-whale.glb');
 assert.equal(bytes.toString('ascii',0,4),'glTF'); assert.equal(bytes.readUInt32LE(4),2); assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'9e1f6eb4d8ace554d8cc324925ae7141c2505419587a2062d218c66208b5f8d0');
 const scene=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.ok(scene.meshes.length>0 && scene.skins.length>0); assert.ok(scene.animations.some((a:{name:string})=>a.name==='Swimming'));
 assert.match(scene.asset.extras.license,/CC-BY-4.0/); assert.match(scene.asset.extras.author,/Bohdan Lvov/);
});
test('self hosted art and explicit source/derivative attribution are present', () => {
 for(const file of ['sky.webp','sangmung.webp','sangmung-wink.webp']) {
  const bytes=readFileSync('public/whale-flight/'+file); assert.equal(bytes.toString('ascii',0,4),'RIFF'); assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 const credit=read('public/whale-flight/credits.txt'); assert.match(credit,/creativecommons.org\/licenses\/by\/4.0/);assert.match(credit,/Bohdan Lvov/);assert.match(credit,/Only blue whales/);
});
test('both navigation systems link to the public flight route with a fullscreen click handler', () => {
 for(const file of ['src/app/components/home/HomeNavigation.tsx','src/app/components/gobibi/BrandNavigation.tsx'])assert.match(read(file),/<FlightLink>고래들의 비상/);
 const link=read('src/app/components/gobibi/FlightLink.tsx');assert.match(link,/href="\/whale-flight"/);assert.match(link,/requestFullscreen/);assert.match(link,/event.metaKey/);
});
test('flight identity uses its own OG URL but preserves the shared homepage key visual', () => {
 const social=pageSocialMetadata('/whale-flight');assert.equal(social.openGraph.url,'https://gobibi.art/whale-flight');assert.equal(social.openGraph.images[0].url,SHARE_IMAGE.url);
 assert.ok(existsSync('src/app/whale-flight/page.tsx'));
});
test('runtime has disposal, independent skeletons, real animations and no video-generation endpoints', () => {
 const scene=read('src/app/whale-flight/flight-scene.ts');assert.match(scene,/cloneSkeleton/);assert.match(scene,/AnimationMixer/);assert.match(scene,/Swimming/);assert.match(scene,/cancelAnimationFrame/);assert.match(scene,/webglcontextlost/);assert.match(scene,/ResizeObserver/);
 assert.doesNotMatch(scene,/api\.openai|api\.fal|generativelanguage\.googleapis|\/api\//);
 const ui=read('src/app/whale-flight/FlightExperience.tsx');assert.match(ui,/prefers-reduced-motion/);assert.match(ui,/visibilitychange/);assert.match(ui,/document.exitFullscreen/);assert.match(ui,/고래들의 비상/);
});
test('flight renders whales only while retaining the homepage character and balloon', () => {
 const scene=read('src/app/whale-flight/flight-scene.ts');assert.doesNotMatch(scene,/mascot|sangmung|wink/i);
 const ui=read('src/app/whale-flight/FlightExperience.tsx');assert.doesNotMatch(ui,/상멍|윙크|onWink|data-wink/);assert.match(ui,/SANG#MUNG/);
 assert.doesNotMatch(read('src/app/whale-flight/page.tsx'),/상멍|윙크/);
 assert.match(read('public/whale-flight/credits.txt'),/whales only; no 2D character overlay/);
 const home=read('src/app/components/home/GobibiWorld.tsx');assert.match(home,/sangmung.webp/);assert.match(home,/data-whale-balloon/);
});
