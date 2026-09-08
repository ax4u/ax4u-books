import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { WHALE_SPECIES, ANIMAL_COUNT, SCENE_POPULATION } from '../src/app/whale-flight/species';
import { createFinlessPorpoise } from '../src/app/whale-flight/finless-porpoise';

const read=(p:string)=>readFileSync(p,'utf8');
test('ten selected whales, original registry preserved; no information-selection catalog',()=>{
 assert.deepEqual(WHALE_SPECIES.map(w=>w.id),['blue','humpback','sperm','orca','porpoise']);
 assert.deepEqual(SCENE_POPULATION,{blue:3,humpback:3,sperm:2,orca:2,porpoise:0});assert.equal(ANIMAL_COUNT,10);
 assert.equal(new Set(WHALE_SPECIES.map(w=>w.scientific)).size,5);
 assert.equal(WHALE_SPECIES.filter(w=>w.model==='gltf').length,4);
 assert.equal(WHALE_SPECIES.filter(w=>w.model==='original').length,1);
 const ui=read('src/app/whale-flight/FlightExperience.tsx');
 assert.doesNotMatch(ui,/SpeciesNavigator|data-active-card|크기 비교|유명한 종 먼저|onSpecies|setSpeciesOrder/);
 assert.match(ui,/data-edition="living-pod"/);
 assert.equal(existsSync('src/app/whale-flight/SpeciesNavigator.tsx'),false);
});
for(const item of WHALE_SPECIES.filter(w=>w.model==='gltf'))test(`${item.id}: licensed anatomy, native skin and animation retained`,()=>{
 const bytes=readFileSync('public'+item.asset);assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.ok(gltf.meshes.length>0 && gltf.skins.length>0);
 assert.ok(gltf.skins.some((skin:{joints:number[]})=>skin.joints.length>3));
 const clip=gltf.animations.find((clip:{name:string})=>clip.name===item.clip);assert.ok(clip);assert.ok(clip.channels.length>3);
 assert.match(gltf.asset.extras.license,/CC-BY-4.0/);assert.doesNotMatch(gltf.asset.extras.license,/-NC|-ND/);
 assert.match(gltf.asset.extras.source,/sketchfab.com\/3d-models/);assert.ok(gltf.asset.extras.author);
 for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView),'All textures self contained');
});
test('finless porpoise has original grey skin, small eyes, no triangular dorsal fin, one-unit body and actual skin motion',()=>{
 const actor=createFinlessPorpoise();const meshes:THREE.Mesh[]=[];const bones:THREE.Bone[]=[];
 actor.root.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);if(o instanceof THREE.Bone)bones.push(o);});
 const skin=meshes.find(o=>o instanceof THREE.SkinnedMesh) as THREE.SkinnedMesh;assert.ok(skin);
 assert.ok(bones.length>=5);assert.ok(actor.root.userData.originalProcedural);
 assert.ok(actor.root.userData.triangles<15000);assert.ok(meshes.length<=10);
 assert.ok(meshes.some(m=>m.name.includes('corneas')));assert.ok(meshes.some(m=>m.name.includes('mouth')));
 assert.ok(!meshes.some(m=>m.name==='dorsal-fin'));
 actor.root.updateMatrixWorld(true);skin.skeleton.update();
 const box=new THREE.Box3().setFromObject(actor.root,true);assert.ok(Math.abs(box.max.z-box.min.z-1)<1e-5);
 const points=skin.geometry.getAttribute('position');let tail=-1,head=-1;
 for(let i=0;i<points.count;i++){if(points.getZ(i)<-.40)tail=i;if(points.getZ(i)>.45)head=i;}
 assert.ok(tail>=0 && head>=0);
 const sample=(t:number)=>{actor.update(t,1);actor.root.updateMatrixWorld(true);skin.skeleton.update();return [skin.getVertexPosition(tail,new THREE.Vector3()),skin.getVertexPosition(head,new THREE.Vector3())]};
 const a=sample(0),b=sample(.33);assert.ok(a[0].distanceTo(b[0])>.002);assert.ok(a[1].distanceTo(b[1])<1e-6,'head remains still relative to body');
 let disposals=0;meshes.forEach(m=>m.geometry.addEventListener('dispose',()=>disposals++));actor.dispose();assert.equal(disposals,meshes.length);actor.dispose();assert.equal(disposals,meshes.length);
});
test('copyright provenance is retained without species information overlays; collision claim is accurately scoped',()=>{
 const credits=read('public/whale-flight/credits.txt');
 for(const item of WHALE_SPECIES)assert.ok(credits.includes(item.scientific));
 for(const author of ['Bohdan Lvov','Abner Wu'])assert.ok(credits.includes(author));
 assert.match(credits,/10 INDEPENDENT ANIMALS/);assert.match(credits,/capsule/i);assert.match(credits,/no 2D character overlay/);
 assert.doesNotMatch(credits,/Alex_Pfe|큰돌고래|참고래|귀신고래|일각고래|흰고래/);
});
