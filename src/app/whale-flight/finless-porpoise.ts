import * as THREE from 'three';

/** Original, hand-sculpted procedural Neophocaena asiaeorientalis anatomical study.
 * No imported/recoloured cetacean meshes or photographic textures. Rest coordinates:
 * nose +Z, dorsum +Y; nose +0.5 / fluke trailing tips -0.5 (one metre total).
 * Call independently for each actor; all disposable resources and bones are owned.
 * SkeletonUtils.clone(root) is supported; a clone needs its own bone animation driver.
 */
type Section = readonly [number, number, number, number, number];
const sections: readonly Section[] = [
  [-.474,.004,.005,.004,-.008],[-.442,.018,.018,.013,-.006],
  [-.38,.027,.041,.023,-.004],[-.30,.043,.070,.043,0],
  [-.20,.071,.102,.068,.002],[-.08,.099,.126,.097,.003],
  [.055,.118,.133,.121,.003],[.15,.120,.131,.129,.003],
  [.25,.111,.120,.112,.005],[.33,.099,.112,.083,.008],
  [.39,.084,.094,.065,.006],[.435,.067,.073,.050,.001],
  [.47,.045,.047,.034,-.007],[.49,.026,.026,.020,-.012],
  [.5,0,0,0,-.016],
];
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;
const ease = (x: number) => { const t = clamp(x, 0, 1); return t*t*(3-2*t); };

// Shape-preserving Hermite splines: no overshoot at the melon, belly or peduncle.
function profile(z: number, column: number): number {
  let i = 0;
  while (i < sections.length-2 && z > sections[i+1][0]) i++;
  const a = sections[i], b = sections[i+1], h = b[0]-a[0];
  const t = clamp((z-a[0])/h,0,1);
  const slope = (j: number) => {
    const l = Math.max(0,j-1), r = Math.min(sections.length-1,j+1);
    if (l===j || r===j) return (sections[r][column]-sections[l][column])/(sections[r][0]-sections[l][0]);
    const x = (sections[j][column]-sections[l][column])/(sections[j][0]-sections[l][0]);
    const y = (sections[r][column]-sections[j][column])/(sections[r][0]-sections[j][0]);
    return x*y <= 0 ? 0 : 2*x*y/(x+y);
  };
  return (2*t*t*t-3*t*t+1)*a[column]+(t*t*t-2*t*t+t)*h*slope(i)
    +(-2*t*t*t+3*t*t)*b[column]+(t*t*t-t*t)*h*slope(i+1);
}

function hull(z: number, angle: number): THREE.Vector3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  // Broad lower thorax, rounded melon and a dorsoventrally compressed tail stock.
  const cheek = 1 + .024*Math.exp(-(((z-.36)/.08)**2))*Math.max(0,-c);
  const x = profile(z,1)*s*cheek;
  let y = profile(z,4)+Math.sign(c)*Math.pow(Math.abs(c),c>0?.91:1.12)*profile(z,c>=0?2:3);
  // Narrow low ridge, never a triangular dorsal fin; 3.2 mm maximum relief.
  const ridge = .0032*Math.exp(-(((z+.12)/.20)**4))*Math.exp(-((s/.064)**2))*Math.max(0,c);
  y += ridge;
  return new THREE.Vector3(x,y,z);
}

type Surface = { p: number[]; uv: number[]; color: number[]; indices: number[] };
const emptySurface = (): Surface => ({p:[],uv:[],color:[],indices:[]});

export function createFinlessPorpoise(): { root: THREE.Group; update(time: number, speed?: number): void; dispose(): void } {
  const root = new THREE.Group();
  root.name = 'original-korean-finless-porpoise';
  root.userData = { species:'Neophocaena asiaeorientalis', originalProcedural:true,
    restBodyLength:1, axis:'nose +Z, dorsal +Y', animation:'five-bone dorsoventral fluking' };
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const skinSurface = emptySurface();
  const dark = new THREE.Color('#41494b'), belly = new THREE.Color('#969d9b');
  const colour = new THREE.Color();

  function surface(target: Surface, rows: number, cols: number, sample: (u:number,v:number)=>THREE.Vector3, fin=false, reverse=false) {
    const base = target.p.length/3;
    for(let i=0;i<=rows;i++) for(let j=0;j<=cols;j++) {
      const u=i/rows,v=j/cols,p=sample(u,v);
      target.p.push(p.x,p.y,p.z); target.uv.push(v,u);
      const center=profile(clamp(p.z,-.474,.5),4);
      const depth=Math.max(.018,profile(clamp(p.z,-.474,.5),3));
      const pale=fin ? .38*ease((-Math.sin(v*TAU)-.10)/.80) : .83*ease((-(p.y-center)/depth-.13)/.82);
      const variation=1+.022*Math.sin(p.z*107+p.x*73)*Math.sin(p.y*89+p.z*41);
      colour.copy(dark).lerp(belly,pale).multiplyScalar(variation);
      target.color.push(colour.r,colour.g,colour.b);
      if(i<rows && j<cols) {
        const a=base+i*(cols+1)+j,b=a+cols+1;
        if(reverse)target.indices.push(a,b,a+1,a+1,b,b+1);
        else target.indices.push(a,a+1,b,a+1,b+1,b);
      }
    }
  }

  // Longitudinal density is concentrated at the round anterior face, without a beak.
  surface(skinSurface,76,56,(u,v)=>hull(lerp(-.474,.5,1-Math.pow(1-u,1.22)),v*TAU),false,true);

  // Embedded, filleted pectoral roots; swept rounded blades rather than cone fins.
  for(const side of [-1,1]) {
    surface(skinSurface,22,20,(u,v)=>{
      const t=v*TAU;
      const chord=(.084*(1-u)+.038*Math.sin(Math.PI*u))*Math.sqrt(1-u);
      const thick=.012*Math.pow(1-u,1.25);
      const x=side*(.083+.108*u);
      const y=-.066-.056*u+.007*Math.sin(Math.PI*u)+thick*Math.sin(t);
      const z=.204-.120*u+chord*.5*Math.cos(t);
      return new THREE.Vector3(x,y,z);
    },true,side>0);
  }
  // Horizontal bilobed flukes: leading edge sweep, central trailing notch, thin tips.
  // Trailing edge is explicitly -0.5 at u=.5; no hidden normalization parent scale.
  for(const side of [-1,1]) {
    surface(skinSurface,24,18,(u,v)=>{
      const t=v*TAU;
      const x=side*.156*u;
      const leading=-.407+.034*u-.012*Math.sin(Math.PI*u);
      const back=u<=.5 ? lerp(-.478,-.5,ease(2*u)) : lerp(-.5,-.373,ease(2*u-1));
      const width=leading-back;
      const center=(leading+back)/2;
      const z=center+width*.5*Math.cos(t);
      const y=-.007+.009*u*u+.006*Math.sin(Math.PI*u)+.010*(1-u)*Math.sin(t);
      // The useful trailing edge reaches exactly -.5 at the half-span station.
      return new THREE.Vector3(x,y, Math.max(-.5,z));
    },true,side>0);
  }

  // Seamless deterministic pore map: monochrome height and wet-skin roughness in G.
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=TAU*x/size,v=TAU*y/size;
    const grain=Math.sin(31*u+3*Math.sin(7*v))*Math.sin(29*v+2*Math.sin(5*u));
    const fine=Math.sin(53*u+47*v)*Math.sin(41*v-37*u);
    const k=4*(y*size+x);
    data[k]=Math.round(128+22*grain+8*fine);
    data[k+1]=Math.round(174+15*grain+7*fine);data[k+2]=data[k];data[k+3]=255;
  }
  const pores=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  pores.wrapS=pores.wrapT=THREE.RepeatWrapping;pores.repeat.set(6,9);
  pores.magFilter=THREE.LinearFilter;pores.minFilter=THREE.LinearMipmapLinearFilter;
  pores.generateMipmaps=true;pores.needsUpdate=true;textures.push(pores);
  const skin=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.48,roughnessMap:pores,
    bumpMap:pores,bumpScale:.00009,metalness:0,clearcoat:.38,clearcoatRoughness:.19,
    specularIntensity:.85,side:THREE.DoubleSide});
  const crease=new THREE.MeshStandardMaterial({color:'#20282a',roughness:.49});
  const eyeMaterial=new THREE.MeshPhysicalMaterial({color:'#101b1e',roughness:.055,
    metalness:0,clearcoat:1,clearcoatRoughness:.025,ior:1.38});
  materials.push(skin,crease,eyeMaterial);

  const boneZ=[.25,.015,-.19,-.345,-.435];
  const bones=boneZ.map((z,i)=>{const b=new THREE.Bone();b.name=['head-fixed','thorax','lumbar','peduncle','flukes'][i];
    b.position.z=i===0?z:z-boneZ[i-1];return b;});
  for(let i=1;i<bones.length;i++)bones[i-1].add(bones[i]);
  root.add(bones[0]);
  const skeleton=new THREE.Skeleton(bones);

  function geometry(s: Surface, skinned=false) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(s.p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(s.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(s.color,3));g.setIndex(s.indices);
    if(skinned) {
      const indices:number[]=[],weights:number[]=[];
      for(let i=0;i<s.p.length;i+=3) {
        const z=s.p[i+2];let a=0;
        while(a<boneZ.length-2 && z<boneZ[a+1])a++;
        const w=ease((boneZ[a]-z)/(boneZ[a]-boneZ[a+1]));
        indices.push(a,a+1,0,0);weights.push(1-w,w,0,0);
      }
      g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
      g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    }
    g.computeVertexNormals();
    // Average circumference seam normals, avoiding a visible longitudinal lighting zip.
    const positions=g.getAttribute('position'),normals=g.getAttribute('normal');
    const coincident=new Map<string,number[]>();
    for(let i=0;i<positions.count;i++) {
      const key=`${positions.getX(i).toFixed(6)},${positions.getY(i).toFixed(6)},${positions.getZ(i).toFixed(6)}`;
      const bucket=coincident.get(key);if(bucket)bucket.push(i);else coincident.set(key,[i]);
    }
    for(const bucket of coincident.values())if(bucket.length>1) {
      const n=new THREE.Vector3();for(const i of bucket)n.add(new THREE.Vector3().fromBufferAttribute(normals,i));n.normalize();
      for(const i of bucket)normals.setXYZ(i,n.x,n.y,n.z);
    }
    g.computeBoundingBox();g.computeBoundingSphere();geometries.push(g);return g;
  }
  const body=new THREE.SkinnedMesh(geometry(skinSurface,true),skin);
  body.name='finless-porpoise-skin';root.add(body);root.updateMatrixWorld(true);body.bind(skeleton);
  // Exact rest-pose Box3; conservative culling sphere prevents per-frame CPU skin bounds.
  body.boundingBox=body.geometry.boundingBox!.clone();
  body.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,-.015),.66);

  const face=emptySurface(),eyes=emptySurface();
  // A narrow anatomical mouth crease follows the actual lower face on both sides.
  function appendGeometry(target:Surface,g:THREE.BufferGeometry) {
    const p=g.getAttribute('position'),uv=g.getAttribute('uv'),base=target.p.length/3;
    for(let i=0;i<p.count;i++){target.p.push(p.getX(i),p.getY(i),p.getZ(i));target.uv.push(uv?uv.getX(i):0,uv?uv.getY(i):0);target.color.push(1,1,1);}
    if(g.index)for(let i=0;i<g.index.count;i++)target.indices.push(base+g.index.getX(i));
    else for(let i=0;i<p.count;i++)target.indices.push(base+i);
    g.dispose();
  }
  for(const side of [-1,1]) {
    const points:THREE.Vector3[]=[];
    for(let i=0;i<=24;i++) {
      const u=i/24,z=lerp(.4985,.365,u),theta=side*(1.92-.13*Math.sin(Math.PI*u));
      const p=hull(z,theta);p.x+=side*.00065;p.y-=.00025;points.push(p);
    }
    appendGeometry(face,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),30,.00083,5,false));
    const eye=hull(.374,side*1.43);
    eye.x+=side*.0012;
    const g=new THREE.SphereGeometry(1,14,10);g.scale(.0024,.0034,.0041);g.translate(eye.x,eye.y,eye.z);
    appendGeometry(eyes,g);
  }
  // One crescent blowhole (not paired nostrils) set into the upper head, with a lip.
  const blowPoints:THREE.Vector3[]=[];
  for(let i=0;i<=24;i++) {
    const t=lerp(-1,1,i/24),x=.011*t,z=.319+.005*(1-t*t);
    const angle=Math.asin(x/profile(z,1)),p=hull(z,angle);p.y+=.00045;blowPoints.push(p);
  }
  appendGeometry(face,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(blowPoints),24,.0012,6,false));
  for(const [s,mat,name] of [[face,crease,'mouth-and-blowhole'],[eyes,eyeMaterial,'small-wet-corneas']] as const) {
    const mesh=new THREE.Mesh(geometry(s),mat);mesh.name=name;
    // Face coordinates are baked in model space, with the head bone fixed at rest.
    mesh.position.z=-boneZ[0];bones[0].add(mesh);
  }
  root.updateMatrixWorld(true);skeleton.update();
  root.userData.triangles=geometries.reduce((sum,g)=>sum+(g.index?g.index.count:g.getAttribute('position').count)/3,0);
  root.userData.drawCalls=3;root.userData.boneCount=bones.length;
  // Geometry-space endpoints are exact Float32-representable +/- .5.
  const rest=body.geometry.boundingBox!;
  if(Math.abs(rest.min.z+.5)>1e-7 || Math.abs(rest.max.z-.5)>1e-7)throw new Error('Finless porpoise rest length must equal 1.0');
  root.userData.restBounds={min:rest.min.toArray(),max:rest.max.toArray()};
  const axis=new THREE.Vector3(1,0,0);
  let disposed=false;
  return {
    root,
    update(time:number,speed=1) {
      if(disposed)return;
      const rate=clamp(Number.isFinite(speed)?speed:1,0,3),t=(Number.isFinite(time)?time:0)*TAU*(.70+.35*rate);
      const strength=rate===0?0:.60+.40*Math.min(rate,1.5);
      // No geometry edits, CPU vertex loops, transform drift or per-frame allocation.
      bones[1].quaternion.setFromAxisAngle(axis,.025*Math.sin(t)*strength);
      bones[2].quaternion.setFromAxisAngle(axis,.105*Math.sin(t-.46)*strength);
      bones[3].quaternion.setFromAxisAngle(axis,.19*Math.sin(t-.92)*strength);
      bones[4].quaternion.setFromAxisAngle(axis,.22*Math.sin(t-1.48)*strength);
    },
    dispose() {
      if(disposed)return;disposed=true;
      for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
      skeleton.dispose();root.clear();
    },
  };
}
