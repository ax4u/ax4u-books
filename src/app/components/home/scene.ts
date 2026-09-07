import * as T from 'three';

export type SceneMode = 'wave' | 'salute' | 'rescue';
export type SceneControls = { mode: SceneMode; paused: boolean; reduced: boolean };
const ink = 0x182c48;
const material = (color: T.ColorRepresentation, roughness = .72) => new T.MeshStandardMaterial({ color, roughness });
function ball(parent: T.Object3D, color: T.ColorRepresentation, position: number[], scale: number[]) {
  const m = new T.Mesh(new T.SphereGeometry(1, 40, 28), material(color));
  m.position.set(...position as [number, number, number]); m.scale.set(...scale as [number, number, number]); m.castShadow = true; parent.add(m); return m;
}
function stroke(parent: T.Object3D, points: number[][], color = ink, radius = .018) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p as [number, number, number])));
  const mesh = new T.Mesh(new T.TubeGeometry(curve, 32, radius, 8, false), material(color)); parent.add(mesh); return mesh;
}
function shape(parent: T.Object3D, points: number[][], color: T.ColorRepresentation, depth = .12) {
  const s = new T.Shape(); points.forEach(([x,y], i) => i ? s.lineTo(x,y) : s.moveTo(x,y)); s.closePath();
  const mesh = new T.Mesh(new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .045, bevelThickness: .04 }), material(color)); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function heart(parent: T.Object3D) {
  const s = new T.Shape(); s.moveTo(0, -.27); s.bezierCurveTo(-.66,.12,-.30,.57,0,.28); s.bezierCurveTo(.30,.57,.66,.12,0,-.27);
  const h = new T.Mesh(new T.ShapeGeometry(s,32), material(0xf0c8cf)); h.position.set(0,.94,.603); h.scale.setScalar(.88); parent.add(h);
}
function mascot() {
  const root = new T.Group();
  ball(root, 0xcccccc,[0,1.12,0],[.68,.82,.54]);
  ball(root, 0xcccccc,[0,1.97,.015],[.82,.79,.65]);
  // One continuous lower silhouette, split into precisely two tail lobes. No legs or rear tail.
  const fins = shape(root,[[-.43,.76],[-.62,.43],[-.88,.15],[-.86,.04],[-.62,.02],[0,.32],[.62,.02],[.86,.04],[.88,.15],[.62,.43],[.43,.76]],0xcccccc,.42);
  fins.position.z=-.23;
  const arms = [-1,1].map(side => { const g=new T.Group(); g.position.set(side*.54,1.44,0); ball(g,0xcccccc,[side*.16,-.27,0],[.21,.48,.23]).rotation.z=side*.35;root.add(g);return g; });
  heart(root);
  for (const side of [-1,1]) ball(root,0x252b32,[side*.29,2.08,.613],[.045,.096,.033]);
  stroke(root,[[-.40,1.89,.586],[-.28,1.82,.625],[-.13,1.91,.657],[0,1.94,.666],[.13,1.91,.657],[.28,1.82,.625],[.40,1.89,.586]],0x555d65,.016);
  for(const x of [-.17,-.08]) stroke(root,[[x,2.43,.536],[x+.1,2.60,.438]],0xa4abb0,.009);
  for(const y of [2.47,2.54]) stroke(root,[[-.20,y,.51],[.04,y+.012,.51]],0xa4abb0,.009);
  const hat = new T.Group(); hat.position.set(0,2.62,.03);hat.rotation.z=-.13;root.add(hat);
  shape(hat,[[-.54,.07],[-.36,.46],[.49,.31],[.31,.02]],0xfffdf1,.12).position.z=.10;
  shape(hat,[[-.36,.46],[-.10,.71],[.17,.39]],0xe9e8e0,.12).position.z=-.09;
  stroke(hat,[[-.36,.46,-.03],[.17,.39,-.03],[-.10,.71,-.03]],0xaeb8c3,.012);
  stroke(hat,[[-.19,.35,.287],[-.19,.14,.287],[-.28,.20,.287]],ink,.014);
  stroke(hat,[[-.19,.14,.287],[-.10,.20,.287]],ink,.014);
  stroke(hat,[[-.25,.29,.287],[-.13,.29,.287]],ink,.012);
  const circle=new T.Mesh(new T.TorusGeometry(.031,.009,8,20),material(ink));circle.position.set(-.19,.385,.287);hat.add(circle);
  return { root, arms };
}
function book(color: number, width=1) {
  const root=new T.Group();
  for(const side of [-1,1]) {
    const leaf=new T.Group(); leaf.rotation.z=side*.11;root.add(leaf);
    const cover=new T.Mesh(new T.BoxGeometry(width,.07,width*1.28),material(color));cover.position.set(side*width/2,0,0);cover.castShadow=true;leaf.add(cover);
    const paper=new T.Mesh(new T.BoxGeometry(width*.96,.11,width*1.23),material(0xfff9e9));paper.position.set(side*width/2,.08,0);paper.receiveShadow=true;paper.castShadow=true;leaf.add(paper);
    for(let i=0;i<3;i++){const line=new T.Mesh(new T.BoxGeometry(width*.57,.005,.012),material(0xcbd4da));line.position.set(side*width*.51,.14,-width*.32+i*.09);leaf.add(line);}
  } return root;
}
function sailor() {
  const g=new T.Group();ball(g,0xf0c7a4,[0,.40,0],[.20,.22,.20]);ball(g,0xf8f5ec,[0,.08,0],[.21,.24,.16]);
  for(const side of [-1,1])ball(g,ink,[side*.075,.44,.182],[.018,.023,.012]);
  const cap=new T.Mesh(new T.CylinderGeometry(.22,.24,.10,24),material(0xfffdf6));cap.position.y=.62;g.add(cap);
  stroke(g,[[-.16,.2,.12],[0,.04,.18],[.16,.2,.12]],0x3155bc,.033);
  const arm=new T.Group();arm.position.set(.18,.22,0);ball(arm,0xf8f5ec,[.12,.02,0],[.17,.065,.07]);ball(arm,0xf0c7a4,[.24,.10,0],[.06,.11,.06]);g.add(arm);
  return {root:g,arm};
}

export function mountScene(canvas: HTMLCanvasElement, controls: {current:SceneControls}) {
  // Probe before constructing Three's renderer: unsupported devices get quiet, usable fallback.
  const context=canvas.getContext('webgl2',{alpha:true,antialias:true}); if(!context) return null;
  const renderer=new T.WebGLRenderer({canvas,context,alpha:true,antialias:true}); renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0x000000,0);
  const scene=new T.Scene();const camera=new T.PerspectiveCamera(35,1,.1,60);camera.position.set(0,4.1,10.8);camera.lookAt(0,1.55,0);
  scene.add(new T.HemisphereLight(0xffffff,0x9daec8,3));const light=new T.DirectionalLight(0xffedd9,5);light.position.set(-3,7,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-6;light.shadow.camera.right=6;light.shadow.camera.top=6;light.shadow.camera.bottom=-6;light.shadow.bias=-.001;scene.add(light);
  const world=new T.Group();scene.add(world);
  const stage=book(ink,2.13);stage.position.set(0,-.03,.05);world.add(stage);
  const hero=mascot();hero.root.position.y=.28;hero.root.rotation.y=-.10;world.add(hero.root);
  const seaman=sailor();seaman.root.position.set(1.56,.36,.30);world.add(seaman.root);
  const friend=sailor();friend.root.position.set(-1.55,.35,.3);world.add(friend.root);
  const buoy=new T.Group();const ring=new T.Mesh(new T.TorusGeometry(.38,.105,16,64),material(0xfffcf1));buoy.add(ring);
  for(let i=0;i<4;i++){const stripe=new T.Mesh(new T.TorusGeometry(.38,.108,12,12,.42),material(0xf17961));stripe.rotation.z=i*Math.PI/2;buoy.add(stripe);}buoy.position.set(1.58,.37,.48);buoy.rotation.x=-.75;world.add(buoy);
  const floaters=[book(0xf17961,.38),book(0x345ee8,.32),book(0x749988,.27)];const positions=[[-1.75,2.67,-.5],[1.85,3.1,-.8],[2.23,1.68,-.4]];
  floaters.forEach((b,i)=>{b.position.set(...positions[i] as [number,number,number]);b.rotation.set(.35,.2,i%2?.4:-.4);world.add(b);});
  // A little flying storybook bird, built as volume rather than a billboard.
  const bird=new T.Group();ball(bird,0xf0b94f,[0,0,0],[.20,.14,.15]);const wings=[-1,1].map(s=>{const w=ball(bird,0xffd984,[s*.20,.02,0],[.22,.045,.14]);return w;});ball(bird,ink,[.12,.05,.12],[.02,.02,.015]);shape(bird,[[.15,0],[.29,.01],[.17,.09]],0xe97955,.04);bird.position.set(-1.75,3.55,0);world.add(bird);
  const shadow=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({opacity:.11}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.36;shadow.receiveShadow=true;scene.add(shadow);
  const water=new T.Mesh(new T.CircleGeometry(.82,48),new T.MeshStandardMaterial({color:0x6ab6ce,transparent:true,opacity:.55,roughness:.35}));water.rotation.x=-Math.PI/2;water.position.set(2.25,.03,.60);world.add(water);
  let width=0,height=0,frame=0,time=0,last=0,visible=true,lastMode:SceneMode='wave',modeStart=0;const pointer=new T.Vector2();
  const resize=()=>{width=canvas.clientWidth;height=canvas.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/Math.max(height,1);camera.position.z=camera.aspect<.85?13:10.8;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
  const move=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width-.5,(e.clientY-r.top)/r.height-.5);};const leave=()=>pointer.set(0,0);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);
  const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});io.observe(canvas);
  const animate=(now:number)=>{frame=requestAnimationFrame(animate);const delta=Math.min((now-last)/1000,.04);last=now;if(!visible||document.hidden)return;const {mode,paused,reduced}=controls.current;const moving=!paused&&!reduced;if(moving)time+=delta;
    const t=time;hero.root.position.y=.28+(moving?Math.sin(t*2)*.055:0);hero.arms[0].rotation.z=mode==='salute'?-2.3:mode==='rescue'?-.75:-1.3+Math.sin(t*3)*.3;hero.arms[1].rotation.z=mode==='rescue'?1.3:.15;
    seaman.arm.rotation.z=mode==='salute'?1.05:Math.sin(t*2)*.12;friend.arm.rotation.z=mode==='salute'?1.05:.2;
    if(mode!==lastMode){modeStart=time;lastMode=mode;}
    const rescueTime=reduced?5:(time-modeStart)%8;
    const throwProgress=Math.min(rescueTime/1.8,1);
    const pullProgress=Math.max(0,Math.min((rescueTime-2)/3,1));
    water.visible=mode==='rescue';
    seaman.root.position.set(mode==='rescue'?2.25-pullProgress*.8:1.56,mode==='rescue'?.14+pullProgress*.28+Math.sin(t*2)*.03:.36,mode==='rescue'?.6:.3);
    buoy.position.set(mode==='rescue'?(rescueTime<2?.65+throwProgress*1.6:seaman.root.position.x):1.58,mode==='rescue'?(rescueTime<2?.7+Math.sin(throwProgress*Math.PI)*.55:.25+pullProgress*.25):.30,mode==='rescue'?.65:.48);
    buoy.rotation.x=mode==='rescue'?-1.1:-1.05;
    canvas.dataset.rescuePhase=mode==='rescue'?(rescueTime<2?'throw':pullProgress<1?'pull':'safe'):'none';
    canvas.dataset.sailorX=seaman.root.position.x.toFixed(3);
    hero.root.rotation.y=mode==='rescue'?.24:-.10;floaters.forEach((b,i)=>{b.position.y=positions[i][1]+Math.sin(t*1.15+i)*.11;b.rotation.y=.2+Math.sin(t*.7+i)*.18;});bird.position.y=3.45+Math.sin(t*1.8)*.1;wings.forEach((w,i)=>w.rotation.z=Math.sin(t*5)*(i?1:-1)*.4);
    const target=reduced||paused?0:pointer.x*.45;world.rotation.y+=(target-world.rotation.y)*.06;world.rotation.x+=((reduced||paused?0:pointer.y*.10)-world.rotation.x)*.06;
    canvas.dataset.mode=mode;canvas.dataset.motion=moving?'playing':'paused';canvas.dataset.orbit=world.rotation.y.toFixed(3);renderer.render(scene,camera);
  };frame=requestAnimationFrame(animate);
  return ()=>{cancelAnimationFrame(frame);ro.disconnect();io.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});renderer.dispose();};
}
