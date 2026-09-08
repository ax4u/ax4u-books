import * as THREE from 'three';

/** Original procedural anatomical studies, NOT scans or licensed third-party assets.
 * Rest pose: nose +Z, dorsum +Y, left/right X. Snout-to-fluke Z extent = 1;
 * narwhal tusk is additional. time is elapsed seconds; root transform stays caller-owned.
 */
export type SpeciesId = 'fin'|'sperm'|'humpback'|'gray'|'minke'|'orca'|'narwhal'|'beluga'|'bottlenose';
type Station = [z:number, halfWidth:number, upper:number, lower:number, centerY:number, exponent?:number];
type Span = [reach:number, sweep:number, chord:number, thickness:number, camber?:number];
type Profile = { stations:Station[]; flipper:Span[]; fluke:Span[]; dorsal?:Span[]; dorsalZ?:number; attachZ:number; attachY:number; dark:string; light:string; beat:number; amplitude:number };
const TAU = Math.PI * 2;
const clamp = (x:number,a=0,b=1) => Math.max(a,Math.min(b,x));
const smooth = (a:number,b:number,x:number) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const mix = THREE.MathUtils.lerp;
const powSigned = (x:number,p:number) => Math.sign(x)*Math.pow(Math.abs(x),p);

// Hand-authored stations, not one rescaled/recoloured generic body.
const PROFILES:Record<SpeciesId,Profile> = {
 fin:{stations:[[-.46,.002,.004,.004,0],[-.39,.014,.031,.026,0],[-.28,.028,.055,.041,0],[-.12,.050,.070,.061,0],[.04,.067,.073,.069,0],[.18,.068,.065,.061,0],[.31,.055,.039,.036,0],[.41,.031,.019,.021,-.003],[.48,.011,.008,.010,-.006],[.50,0,0,0,-.006]],attachZ:.16,attachY:-.040,flipper:[[0,0,.066,.014],[.040,-.021,.063,.011],[.090,-.053,.040,.007],[.15,-.092,.010,.002],[.16,-.101,0,0]],fluke:[[0,0,.073,.017],[.055,.003,.090,.013],[.117,-.005,.063,.007],[.18,.018,.025,.003],[.196,.039,0,0]],dorsalZ:-.22,dorsal:[[0,0,.085,.017],[.026,-.001,.063,.012],[.054,-.008,.030,.006],[.076,-.026,0,0]],dark:'#3e505a',light:'#d0d3c8',beat:1.12,amplitude:.030},
 sperm:{stations:[[-.46,.002,.004,.004,0],[-.39,.019,.036,.026,0],[-.28,.038,.059,.043,0],[-.13,.061,.078,.058,0],[.02,.082,.084,.071,.006,2.2],[.16,.101,.086,.075,.017,2.9],[.32,.104,.086,.070,.025,3.6],[.435,.096,.080,.059,.030,3.8],[.476,.080,.070,.050,.03,3.4],[.491,.052,.056,.035,.03,2.8],[.50,0,0,0,.032]],attachZ:.055,attachY:-.054,flipper:[[0,0,.082,.023],[.033,-.010,.080,.019],[.075,-.040,.052,.012],[.099,-.063,.020,.006],[.105,-.07,0,0]],fluke:[[0,0,.087,.020],[.05,.003,.107,.018],[.12,-.006,.083,.010],[.20,.014,.036,.004],[.215,.032,0,0]],dorsalZ:-.17,dorsal:[[0,0,.12,.035],[.014,0,.087,.026],[.030,-.016,.049,.017],[.038,-.027,0,0]],dark:'#464849',light:'#807f76',beat:.86,amplitude:.029},
 humpback:{stations:[[-.46,.002,.004,.003,0],[-.39,.018,.038,.027,0],[-.28,.038,.060,.045,0],[-.13,.063,.082,.065,.003],[.03,.088,.087,.077,0],[.16,.097,.078,.074,-.004],[.28,.084,.049,.054,-.008],[.39,.058,.028,.031,-.012],[.468,.028,.015,.018,-.014],[.50,0,0,0,-.017]],attachZ:.14,attachY:-.038,flipper:[[0,0,.095,.023],[.052,-.015,.095,.019],[.12,-.035,.079,.014],[.205,-.067,.055,.009],[.278,-.104,.031,.006],[.310,-.12,.017,.004],[.323,-.125,0,0]],fluke:[[0,0,.090,.021],[.065,-.006,.114,.016],[.14,-.007,.089,.011],[.23,.018,.040,.005],[.25,.044,0,0]],dorsalZ:-.16,dorsal:[[0,0,.113,.027],[.027,.004,.075,.018],[.053,-.017,.036,.009],[.064,-.035,0,0]],dark:'#303b40',light:'#c1c6ba',beat:.98,amplitude:.037},
 gray:{stations:[[-.46,.002,.004,.003,0],[-.38,.020,.035,.027,0],[-.25,.046,.066,.049,0],[-.08,.079,.086,.071,0],[.08,.100,.088,.081,0],[.22,.091,.067,.066,-.005],[.34,.063,.045,.044,-.012],[.435,.032,.025,.029,-.018],[.481,.012,.012,.014,-.02],[.50,0,0,0,-.02]],attachZ:.13,attachY:-.05,flipper:[[0,0,.081,.024],[.045,-.016,.083,.019],[.101,-.055,.057,.012],[.143,-.087,.025,.006],[.154,-.094,0,0]],fluke:[[0,0,.074,.019],[.06,.001,.101,.016],[.14,-.003,.072,.010],[.198,.02,.029,.004],[.214,.035,0,0]],dark:'#626968',light:'#a6aaa2',beat:.91,amplitude:.034},
 minke:{stations:[[-.46,.002,.004,.003,0],[-.38,.015,.032,.025,0],[-.26,.036,.057,.043,0],[-.10,.061,.079,.067,0],[.07,.078,.082,.074,0],[.20,.073,.065,.060,-.002],[.31,.055,.037,.040,-.006],[.405,.029,.018,.024,-.01],[.48,.007,.006,.008,-.011],[.50,0,0,0,-.012]],attachZ:.16,attachY:-.042,flipper:[[0,0,.067,.017],[.04,-.025,.060,.013],[.097,-.061,.040,.008],[.142,-.095,.014,.003],[.153,-.103,0,0]],fluke:[[0,0,.071,.018],[.05,.002,.089,.014],[.11,-.005,.063,.008],[.17,.016,.025,.004],[.186,.036,0,0]],dorsalZ:-.19,dorsal:[[0,0,.093,.021],[.037,-.003,.065,.014],[.073,-.015,.026,.007],[.092,-.038,0,0]],dark:'#34454b',light:'#d6d8cd',beat:1.43,amplitude:.035},
 orca:{stations:[[-.46,.002,.004,.004,0],[-.38,.023,.044,.032,0],[-.25,.055,.080,.057,0],[-.10,.091,.111,.089,0],[.06,.116,.116,.108,0],[.20,.122,.104,.097,0],[.31,.105,.079,.074,-.002],[.39,.076,.055,.051,-.006],[.46,.038,.029,.028,-.009],[.50,0,0,0,-.012]],attachZ:.18,attachY:-.056,flipper:[[0,0,.123,.035],[.046,-.012,.142,.029],[.11,-.051,.119,.022],[.172,-.095,.070,.013],[.194,-.124,.027,.006],[.201,-.134,0,0]],fluke:[[0,0,.093,.025],[.06,0,.123,.020],[.15,-.003,.083,.012],[.223,.025,.035,.005],[.241,.048,0,0]],dorsalZ:-.045,dorsal:[[0,0,.151,.036],[.066,.008,.110,.025],[.15,-.003,.063,.016],[.229,-.023,.022,.007],[.25,-.040,0,0]],dark:'#111b20',light:'#eeeede',beat:1.5,amplitude:.039},
 narwhal:{stations:[[-.46,.002,.004,.004,0],[-.36,.022,.036,.032,0],[-.23,.055,.064,.057,0],[-.07,.087,.088,.080,0],[.09,.111,.101,.091,0],[.24,.110,.092,.077,.006],[.35,.085,.073,.055,.01],[.435,.051,.047,.033,.006],[.478,.025,.019,.019,-.004],[.50,0,0,0,-.008]],attachZ:.155,attachY:-.048,flipper:[[0,0,.079,.023],[.038,-.011,.080,.019],[.084,-.038,.057,.013],[.119,-.057,.024,.006],[.126,-.06,0,0]],fluke:[[0,0,.078,.021],[.06,-.003,.098,.017],[.13,-.014,.073,.010],[.18,-.003,.032,.005],[.193,.015,0,0]],dark:'#9a9f96',light:'#c5c6b8',beat:1.35,amplitude:.036},
 beluga:{stations:[[-.46,.002,.004,.004,0],[-.35,.025,.040,.033,0],[-.23,.058,.068,.058,0],[-.10,.086,.091,.077,0],[.07,.113,.104,.092,0],[.22,.107,.095,.078,.007],[.30,.083,.087,.062,.015],[.369,.077,.082,.044,.027],[.407,.060,.065,.033,.02],[.434,.037,.027,.025,-.001],[.466,.028,.016,.018,-.013],[.49,.014,.011,.013,-.013],[.50,0,0,0,-.013]],attachZ:.155,attachY:-.052,flipper:[[0,0,.092,.026],[.04,-.005,.091,.021],[.09,-.025,.068,.015],[.135,-.045,.032,.008],[.146,-.054,0,0]],fluke:[[0,0,.081,.022],[.06,-.002,.104,.017],[.13,-.009,.075,.011],[.197,.012,.030,.005],[.21,.028,0,0]],dark:'#d6d6c8',light:'#f0efe3',beat:1.45,amplitude:.038},
 bottlenose:{stations:[[-.46,.002,.004,.004,0],[-.37,.017,.033,.023,0],[-.25,.038,.063,.039,0],[-.10,.073,.097,.069,0],[.07,.098,.103,.086,0],[.21,.092,.090,.077,.004],[.30,.076,.079,.062,.008],[.35,.061,.070,.046,.012],[.38,.044,.051,.030,.003],[.399,.026,.020,.020,-.021],[.46,.023,.014,.015,-.025],[.489,.013,.012,.012,-.025],[.50,0,0,0,-.025]],attachZ:.16,attachY:-.046,flipper:[[0,0,.075,.020],[.04,-.025,.068,.014],[.095,-.066,.045,.009],[.145,-.115,.015,.003],[.156,-.13,0,0]],fluke:[[0,0,.077,.020],[.055,0,.094,.015],[.12,-.005,.063,.009],[.178,.018,.024,.004],[.19,.034,0,0]],dorsalZ:-.05,dorsal:[[0,0,.133,.027],[.047,-.003,.093,.020],[.098,-.02,.044,.010],[.128,-.054,0,0]],dark:'#627a80',light:'#c9d1ca',beat:1.95,amplitude:.038}
};

/** Monotone cubic interpolation prevents negative radii and bulbous station overshoot. */
function interpolate(rows:([number,...(number|undefined)[]])[],x:number,column:number):number {
 let i=0; while(i<rows.length-2 && x>rows[i+1][0]) i++;
 const a=rows[i],b=rows[i+1],h=b[0]-a[0],t=clamp((x-a[0])/h);
 const value=(r:(number|undefined)[])=>r[column]??(column===5?2:0);
 const d=(value(b)-value(a))/h;
 const slope=(j:number)=>{if(j===0)return (value(rows[1])-value(rows[0]))/(rows[1][0]-rows[0][0]);if(j===rows.length-1)return (value(rows[j])-value(rows[j-1]))/(rows[j][0]-rows[j-1][0]);const l=(value(rows[j])-value(rows[j-1]))/(rows[j][0]-rows[j-1][0]);const r=(value(rows[j+1])-value(rows[j]))/(rows[j+1][0]-rows[j][0]);return l*r<=0?0:2*l*r/(l+r);};
 const m0=d===0?0:slope(i),m1=d===0?0:slope(i+1);
 return (2*t*t*t-3*t*t+1)*value(a)+(t*t*t-2*t*t+t)*h*m0+(-2*t*t*t+3*t*t)*value(b)+(t*t*t-t*t)*h*m1;
}
function hash(x:number,y:number,z:number):number {const a=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return a-Math.floor(a);}
function noise(x:number,y:number,z:number):number {const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy),fz=smooth(0,1,z-iz);return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);}

export function createOriginalCetacean(id:SpeciesId):{root:THREE.Group;update(time:number):void;dispose():void} {
 const p=PROFILES[id]; if(!p)throw new Error(`Unknown cetacean: ${id}`);
 const root=new THREE.Group();root.name=`original-${id}`;root.userData={originalProcedural:true,species:id,axis:'head +Z / dorsal +Y',restBodyLength:1,anatomicalStudy:true};
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 type Part={mesh:THREE.Mesh;rest:Float32Array;normals:Float32Array;kind:string;side:number;anchorX:number;anchorY:number;anchorZ:number;reach:number};
 const parts:Part[]=[];
 // Seamless original micro-relief, no DOM/Canvas dependency (also works during SSR).
 const size=128,texels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=TAU*x/size,v=TAU*y/size;const n=.55+.15*Math.sin(15*u+3*Math.sin(v))*Math.sin(13*v+2*Math.sin(u))+.1*Math.sin(31*u+17*v);const k=(y*size+x)*4;texels[k]=texels[k+1]=texels[k+2]=Math.round(clamp(n)*255);texels[k+3]=255;}
 const micro=new THREE.DataTexture(texels,size,size,THREE.RGBAFormat);micro.wrapS=micro.wrapT=THREE.RepeatWrapping;micro.repeat.set(12,6);micro.magFilter=THREE.LinearFilter;micro.minFilter=THREE.LinearMipmapLinearFilter;micro.generateMipmaps=true;micro.needsUpdate=true;textures.add(micro);
 const skin=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:id==='beluga'?.4:.48,metalness:0,bumpMap:micro,bumpScale:.00022,clearcoat:.15,clearcoatRoughness:.35});materials.add(skin);
 const dark=new THREE.Color(p.dark),light=new THREE.Color(p.light),color=new THREE.Color();
 function pigment(x:number,y:number,z:number,kind:string,side:number,u:number):THREE.Color {
  const cy=interpolate(p.stations,clamp(z,-.46,.5),4),lower=Math.max(.01,interpolate(p.stations,clamp(z,-.46,.5),3));
  const ventral=1-smooth(-.82,-.23,(y-cy)/lower);
  let pale=ventral*.82;
  if(id==='sperm')pale=ventral*.17;
  if(id==='beluga')pale=.58+ventral*.35;
  if(id==='gray')pale=.17+ventral*.24;
  if(id==='narwhal')pale=.6+ventral*.3;
  if(id==='fin')pale=Math.max(ventral*.85,smooth(.012,.042,x)*smooth(.19,.32,z)*(1-smooth(-.002,.018,y)));
  if(id==='orca'){
   pale=smooth(.63,.76,ventral);
   const patch=((z-.254)/.074)**2+((y-.041)/.033)**2;
   pale=Math.max(pale,(1-smooth(.79,1.03,patch))*smooth(.047,.076,Math.abs(x)));
   const flank=((z+.215)/.112)**2+((y+.025)/.048)**2;
   pale=Math.max(pale,(1-smooth(.8,1.06,flank))*smooth(.024,.052,Math.abs(x)));
   const saddle=((z+.122)/.058)**2+((y-.086)/.059)**2;
   pale=Math.max(pale,(1-smooth(.68,1.1,saddle))*.12);
  }
  if(kind==='flipper'){
   const centerY=p.attachY-.018*Math.sin(u*Math.PI*.65);
   pale=(1-smooth(-.002,.002,y-centerY))*.65;
   if(id==='beluga')pale=.9;
   if(id==='minke')pale=Math.max(pale, smooth(.26,.34,u)*(1-smooth(.53,.61,u)));
   if(id==='humpback')pale=.7+.22*noise(x*38,y*38,z*38);
   if(id==='orca')pale=.01;
  }
  if(kind==='fluke' && id==='orca')pale=y<0?.78:0;
  const mottled=noise(x*135,y*135,z*135),broad=noise(x*36+4,y*36,z*36);
  color.copy(dark).lerp(light,clamp(pale));
  let shade=.95+.1*broad+.025*(mottled-.5);
  if(id==='gray'){const scar=smooth(.58,.72,broad)*(.5+.5*mottled);color.lerp(new THREE.Color('#c3c4b5'),scar*.77);shade-=smooth(.59,.72,mottled)*.2;}
  if(id==='narwhal'){const spot=smooth(.56,.68,mottled);color.lerp(new THREE.Color('#3c4444'),spot*(.78-.35*ventral));}
  if(id==='sperm')shade-=.08*smooth(.77,.9,.5+.5*Math.sin(z*910+12*noise(x*90,y*90,z*90)))*smooth(-.3,.0,z);
  // Fine longitudinal rorqual throat grooves; relief is also sculpted into the hull.
  if(['fin','humpback','minke'].includes(id)&&kind==='body'){
   const theta=Math.atan2(x/(Math.max(.002,interpolate(p.stations,z,1))), (y-cy)/lower);
   const groove=Math.pow(.5+.5*Math.cos(theta*(id==='humpback'?35:55)),14)*ventral*smooth(-.1,.04,z)*(1-smooth(.36,.46,z));shade-=groove*.14;
  }
  return color.multiplyScalar(shade);
 }
 function add(geo:THREE.BufferGeometry,name:string,kind='body',side=0,anchor=new THREE.Vector3(),reach=1,material:THREE.Material=skin):THREE.Mesh {
  geo.computeVertexNormals();geo.computeBoundingSphere();geometries.add(geo);
  const mesh=new THREE.Mesh(geo,material);mesh.name=name;mesh.frustumCulled=false;root.add(mesh);
  parts.push({mesh,rest:new Float32Array(geo.getAttribute('position').array as Float32Array),normals:new Float32Array(geo.getAttribute('normal').array as Float32Array),kind,side,anchorX:anchor.x,anchorY:anchor.y,anchorZ:anchor.z,reach});return mesh;
 }
 function surface(name:string,n:number,m:number,point:(u:number,v:number)=>THREE.Vector3,kind='body',side=0,anchor=new THREE.Vector3(),reach=1):THREE.Mesh {
  const pos:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){const u=i/n,v=j/m,q=point(u,v);pos.push(q.x,q.y,q.z);uv.push(v,u);const c=pigment(q.x,q.y,q.z,kind,side,u);colors.push(c.r,c.g,c.b);}
  for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*(m+1)+j,b=a+m+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
  const mesh=add(g,name,kind,side,anchor,reach);
  // Weld duplicate longitudinal seam normals without introducing a UV discontinuity.
  const normal=g.getAttribute('normal') as THREE.BufferAttribute;
  for(let i=0;i<=n;i++){const a=i*(m+1),b=a+m;const nx=normal.getX(a)+normal.getX(b),ny=normal.getY(a)+normal.getY(b),nz=normal.getZ(a)+normal.getZ(b),l=Math.hypot(nx,ny,nz)||1;normal.setXYZ(a,nx/l,ny/l,nz/l);normal.setXYZ(b,nx/l,ny/l,nz/l);}
  parts[parts.length-1].normals=new Float32Array(normal.array as Float32Array);
  return mesh;
 }
 function hullPoint(z:number,theta:number):THREE.Vector3 {
  const w=interpolate(p.stations,z,1),top=interpolate(p.stations,z,2),bottom=interpolate(p.stations,z,3),cy=interpolate(p.stations,z,4),ex=2/interpolate(p.stations,z,5),s=Math.sin(theta),c=Math.cos(theta);
  let radius=1;
  if(['fin','humpback','minke'].includes(id)&&c<-.25){const grooves=Math.pow(.5+.5*Math.cos(theta*(id==='humpback'?35:55)),12);radius-=.014*grooves*smooth(-.1,.04,z)*(1-smooth(.36,.46,z))*smooth(.25,.7,-c);}
  return new THREE.Vector3(w*powSigned(s,ex)*radius,cy+(c>0?top:bottom)*powSigned(c,ex)*radius,z);
 }
 surface('sculpted-body',96,56,(u,v)=>hullPoint(mix(-.46,.5,u),TAU*v));
 function foil(name:string,span:Span[],anchor:THREE.Vector3,side:number,vertical=false,kind='flipper') {
  const reach=span[span.length-1][0];
  const mesh=surface(name,32,24,(u,v)=>{const r=u*reach,sw=interpolate(span,r,1),ch=interpolate(span,r,2),th=interpolate(span,r,3),a=TAU*v;
   // Lenticular closed hydrofoil: real thickness, rounded leading edge, tapered trailing edge.
   const chord=Math.cos(a)*ch*.5,thickness=Math.sin(a)*th*.5*(.83+.17*Math.cos(a));
   const lobes=id==='humpback'&&kind==='flipper'?(.0025*Math.sin(u*TAU*8))*Math.sin(Math.PI*u)*Math.max(0,Math.cos(a)):0;
   if(vertical)return new THREE.Vector3(anchor.x+thickness,anchor.y+r,anchor.z+sw+chord);
   return new THREE.Vector3(anchor.x+side*r,anchor.y+thickness-.018*Math.sin(u*Math.PI*.65)*(kind==='flipper'?1:0),anchor.z+sw+chord+lobes);
  },kind,side,anchor,reach);
  // Parameter orientation changes under reflection and for upright fins.
  if((!vertical&&side<0)||vertical){const idx=mesh.geometry.index!;for(let i=0;i<idx.count;i+=3){const b=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,b);}mesh.geometry.computeVertexNormals();parts[parts.length-1].normals=new Float32Array(mesh.geometry.getAttribute('normal').array as Float32Array);}
 }
 const attachW=interpolate(p.stations,p.attachZ,1)*.79;
 for(const side of [-1,1])foil(`pectoral-${side<0?'left':'right'}`,p.flipper,new THREE.Vector3(side*attachW,p.attachY,p.attachZ),side);
 for(const side of [-1,1])foil(`fluke-${side<0?'left':'right'}`,p.fluke,new THREE.Vector3(0,0,-.437),side,false,'fluke');
 if(p.dorsal&&p.dorsalZ!==undefined){const y=interpolate(p.stations,p.dorsalZ,2)+interpolate(p.stations,p.dorsalZ,4)-.005;foil('dorsal-fin',p.dorsal,new THREE.Vector3(0,y,p.dorsalZ),1,true,'dorsal');}
 function ellipsoid(name:string,position:THREE.Vector3,scale:THREE.Vector3,material:THREE.Material=skin){const g=new THREE.SphereGeometry(1,20,12);g.scale(scale.x,scale.y,scale.z);g.translate(position.x,position.y,position.z);if(material===skin){const a=g.getAttribute('position'),cols:number[]=[];for(let i=0;i<a.count;i++){const c=pigment(a.getX(i),a.getY(i),a.getZ(i),'detail',0,0);cols.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));}return add(g,name,'detail',0,new THREE.Vector3(),1,material);}
 // Dorsal ridge/knuckles (not an incorrectly added triangular dorsal fin).
 if(['gray','narwhal','beluga','sperm'].includes(id)){
  if(id==='gray'||id==='sperm'){for(let k=0;k<(id==='gray'?8:5);k++){const z=-.10-k*.040,y=interpolate(p.stations,z,2)+interpolate(p.stations,z,4)-.004;ellipsoid(`dorsal-knuckle-${k}`,new THREE.Vector3(0,y,z),new THREE.Vector3(.013-k*.0007,(k===0?.020:.009),.029-k*.0015));}}
  else{const z=-.11,y=interpolate(p.stations,z,2)-.009;foil('low-dorsal-ridge',[[0,0,.32,.021],[.013,-.008,.20,.014],[.021,-.016,0,0]],new THREE.Vector3(0,y,z),1,true,'ridge');}
 }
 if(id==='sperm')ellipsoid('slender-lower-jaw',new THREE.Vector3(0,-.050,.309),new THREE.Vector3(.025,.018,.179));
 const eyeMat=new THREE.MeshPhysicalMaterial({color:'#060a0c',roughness:.18,clearcoat:.6});materials.add(eyeMat);
 const mouthMat=new THREE.MeshStandardMaterial({color:id==='beluga'?'#7d847e':'#172126',roughness:.65});materials.add(mouthMat);
 const eyeZ=id==='sperm'?.145:id==='bottlenose'?.326:id==='beluga'?.355:.315;
 for(const side of [-1,1]){const theta=side*1.72,q=hullPoint(eyeZ,theta);q.x*=1.007;ellipsoid(`eye-${side}`,q,new THREE.Vector3(.0024,.0041,.0051),eyeMat);
  // Mouth curves conform to the sculpted hull instead of floating straight lines.
  const pts:THREE.Vector3[]=[];const begin=id==='sperm'?.17:id==='bottlenose'?.34:.26;
  for(let k=0;k<=28;k++){const z=mix(begin,.491,k/28),q=hullPoint(z,side*(id==='sperm'?2.35:2.14));q.multiply(new THREE.Vector3(1.003,1.003,1));pts.push(q);}
  const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),56,id==='beluga'?.0007:.00085,5,false);add(g,`mouth-crease-${side}`,'detail',0,new THREE.Vector3(),1,mouthMat);
 }
 // Subtle blowhole(s), correctly on the dorsum rather than a cartoon nose.
 const bz=id==='sperm'?.442:id==='bottlenose'?.255:.268;
 for(const side of (['fin','humpback','gray','minke'].includes(id)?[-1,1]:[0])){const q=hullPoint(bz,side*.055);q.y+=.0005;ellipsoid(`blowhole-${side}`,q,new THREE.Vector3(.0024,.0009,.006),mouthMat);}
 if(id==='humpback')for(const side of [-1,1])for(let k=0;k<7;k++){const z=.27+k*.029,q=hullPoint(z,side*(.83+k*.023));ellipsoid(`rostral-tubercle-${side}-${k}`,q,new THREE.Vector3(.0042,.0032,.0048));}
 if(id==='narwhal'){
  const ivory=new THREE.MeshStandardMaterial({color:'#d6ceb0',roughness:.52,bumpMap:micro,bumpScale:.0002});materials.add(ivory);
  const tusk=surface('helical-left-tusk',180,24,(u,v)=>{const a=TAU*v,rr=.0115*Math.pow(1-u,.8)*(1+.105*Math.cos(a+u*TAU*18));return new THREE.Vector3(- .016+rr*Math.sin(a),-.010+rr*Math.cos(a),.465+u*.56);},'tusk');tusk.material=ivory;
 }
 // Normalise *all* rest geometry, excluding only the narwhal tusk from extent measurement.
 let minZ=Infinity,maxZ=-Infinity;for(const part of parts)if(part.kind!=='tusk')for(let i=2;i<part.rest.length;i+=3){minZ=Math.min(minZ,part.rest[i]);maxZ=Math.max(maxZ,part.rest[i]);}
 const scale=1/(maxZ-minZ),center=(minZ+maxZ)*.5;
 for(const part of parts){const a=part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<a.count;i++){a.setXYZ(i,a.getX(i)*scale,a.getY(i)*scale,(a.getZ(i)-center)*scale);}part.rest=new Float32Array(a.array as Float32Array);part.anchorX*=scale;part.anchorY*=scale;part.anchorZ=(part.anchorZ-center)*scale;part.reach*=scale;part.mesh.geometry.computeBoundingSphere();}
 let disposed=false;
 function update(time:number):void {
  if(disposed)return;const t=Number.isFinite(time)?time:0,phase=t*p.beat,amplitude=p.amplitude*scale;
  for(const part of parts){const positions=part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute,normals=part.mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
   for(let i=0;i<positions.count;i++){const j=i*3;let x=part.rest[j],y=part.rest[j+1],z=part.rest[j+2],nx=part.normals[j],ny=part.normals[j+1],nz=part.normals[j+2];
    if(part.kind==='flipper'){
     const u=clamp(Math.abs(x-part.anchorX)/part.reach),angle=part.side*(.065*Math.sin(phase*.71+part.side*.24)+.09*Math.sin(phase*.43))*smooth(0,1,u),c=Math.cos(angle),s=Math.sin(angle),dx=x-part.anchorX,dy=y-part.anchorY;
     x=part.anchorX+dx*c-dy*s;y=part.anchorY+dx*s+dy*c;const xx=nx*c-ny*s;ny=nx*s+ny*c;nx=xx;
    }
    const q=clamp((.18-z)/.68),wavePhase=phase-q*1.7;
    const w=amplitude*q*q*Math.sin(wavePhase);
    const derivative=q>0&&q<1?amplitude*(-1/.68)*(2*q*Math.sin(wavePhase)-1.7*q*q*Math.cos(wavePhase)):0;
    const angle=Math.atan(derivative),c=Math.cos(angle),s=Math.sin(angle),baseY=y;
    y=baseY*c+w;z=z-baseY*s;
    const normalY=ny*c+nz*s;const normalZ=nz*c-ny*s;ny=normalY;nz=normalZ;
    // Additional compliant hydrofoil pitch, continuous at the caudal insertion.
    if(part.kind==='fluke'){
     const hinge=part.anchorZ,local=part.rest[j+2]-hinge,bend=.25*Math.sin(phase-1.7+.65),weight=smooth(0,.04,Math.abs(local));y+=local*Math.sin(bend)*weight;ny-=nz*Math.sin(bend)*weight;
    }
    const length=Math.hypot(nx,ny,nz)||1;positions.setXYZ(i,x,y,z);normals.setXYZ(i,nx/length,ny/length,nz/length);
   }
   positions.needsUpdate=true;normals.needsUpdate=true;
  }
 }
 function dispose():void {if(disposed)return;disposed=true;root.removeFromParent();root.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const texture of textures)texture.dispose();parts.length=0;geometries.clear();materials.clear();textures.clear();}
 return {root,update,dispose};
}
