import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { WHALE_SPECIES, orderedSpecies } from '../src/app/whale-flight/species';
import { createOriginalCetacean, type SpeciesId } from '../src/app/whale-flight/original-cetaceans';

const read=(p:string)=>readFileSync(p,'utf8');
test('catalog names ten scientifically distinct species with editorial and physical orders',()=>{
 assert.equal(WHALE_SPECIES.length,10);
 for(const key of ['id','scientific','familiarRank'] as const)assert.equal(new Set(WHALE_SPECIES.map(w=>w[key])).size,10);
 assert.equal(WHALE_SPECIES.filter(w=>w.model==='gltf').length,5);
 assert.equal(WHALE_SPECIES.filter(w=>w.model==='original').length,5);
 const sizes=orderedSpecies('size');assert.equal(sizes[0].id,'blue');assert.equal(sizes.at(-1)?.id,'bottlenose');
 for(let i=1;i<sizes.length;i++)assert.ok(sizes[i-1].length>sizes[i].length);
 assert.notDeepEqual(orderedSpecies('familiar').map(w=>w.id),sizes.map(w=>w.id));
 for(const item of WHALE_SPECIES){assert.ok(item.length>0);assert.match(item.source,/^https:\/\//);assert.ok(item.lengthNote.length>0);}
});
for(const item of WHALE_SPECIES.filter(w=>w.model==='gltf'))test(`${item.id}: licensed anatomical GLB includes its own animated skeleton`,()=>{
 const bytes=readFileSync('public'+item.asset);assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.ok(gltf.meshes.length>0 && gltf.skins.length>0);
 assert.ok(gltf.skins.some((skin:{joints:number[]})=>skin.joints.length>3));
 const clip=gltf.animations.find((clip:{name:string})=>clip.name===item.clip);assert.ok(clip);assert.ok(clip.channels.length>3);
 assert.match(gltf.asset.extras.license,/CC-BY-4.0/);assert.doesNotMatch(gltf.asset.extras.license,/-NC|-ND/);
 assert.match(gltf.asset.extras.source,/sketchfab.com\/3d-models/);assert.ok(gltf.asset.extras.author);
 if(item.id==='bottlenose')assert.equal(gltf.meshes.length,5,'No decorative bubble meshes');
 for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView),'All textures self contained');
});
const hashes=new Set<string>();
for(const item of WHALE_SPECIES.filter(w=>w.model==='original'))test(`${item.id}: distinct original geometry, correct fin anatomy, real body/tail deformation and disposal`,()=>{
 const model=createOriginalCetacean(item.id as SpeciesId);const parts:THREE.Mesh[]=[];
 model.root.traverse(obj=>{if(obj instanceof THREE.Mesh)parts.push(obj);});
 const body=parts.find(p=>p.name==='sculpted-body');assert.ok(body);
 assert.equal(parts.filter(p=>p.name.startsWith('pectoral-')).length,2);
 assert.equal(parts.filter(p=>p.name.startsWith('fluke-')).length,2);
 if(['beluga','narwhal','gray'].includes(item.id))assert.ok(!parts.some(p=>p.name==='dorsal-fin'));
 else assert.ok(parts.some(p=>p.name==='dorsal-fin'));
 assert.equal(parts.some(p=>p.name==='helical-left-tusk'),item.id==='narwhal');
 const positions=body.geometry.getAttribute('position');
 const hash=createHash('sha256').update(Buffer.from(positions.array.buffer,positions.array.byteOffset,positions.array.byteLength)).digest('hex');assert.ok(!hashes.has(hash));hashes.add(hash);
 const values=[...positions.array];assert.ok(values.every(Number.isFinite));
 let min=Infinity,max=-Infinity;for(const mesh of parts.filter(p=>!p.name.includes('tusk'))){const a=mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++){min=Math.min(min,a.getZ(i));max=Math.max(max,a.getZ(i));}}
 assert.ok(Math.abs(max-min-1)<.00001,'Rest body is one normalized unit, excluding tusk');
 model.update(0);const rest=[...positions.array];model.update(1.3);const next=[...positions.array];
 let tail=0,head=0;for(let i=0;i<positions.count;i++){const dz=values[i*3+2];const motion=Math.abs(next[i*3+1]-rest[i*3+1]);if(dz<-.3)tail=Math.max(tail,motion);if(dz>.3)head=Math.max(head,motion);}
 assert.ok(tail>.001,'Actual tail vertices move');assert.ok(head<.00001,'Not a rigid whole-body bob masquerading as swimming');
 let count=0;for(const mesh of parts)mesh.geometry.addEventListener('dispose',()=>count++);model.dispose();assert.equal(count,parts.length);model.dispose();assert.equal(count,parts.length);
});
test('user-facing provenance distinguishes licensed models, original modeling, size reference and subjective order',()=>{
 const credits=read('public/whale-flight/credits.txt');
 for(const item of WHALE_SPECIES)assert.ok(credits.includes(item.scientific));
 for(const author of ['Bohdan Lvov','Abner Wu','Alex_Pfe'])assert.ok(credits.includes(author));
 assert.match(credits,/not population means/);assert.match(credits,/not a measured global popularity ranking/);assert.match(credits,/no 2D character overlay/);
 const ui=read('src/app/whale-flight/FlightExperience.tsx');assert.match(ui,/직접 모델링/);assert.match(ui,/평균이나 최대/);assert.match(ui,/객관적인 인기 순위는 아닙니다/);
});
