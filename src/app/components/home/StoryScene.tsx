'use client';

import { useEffect, useRef, useState } from 'react';
import type { SceneControls, SceneMode } from './scene';
import styles from '../../home.module.css';

const modes: {id:SceneMode;label:string;description:string}[] = [
  {id:'wave',label:'인사하기',description:'안녕! 상멍이와 함께 책 밖으로 모험을 떠나요.'},
  {id:'salute',label:'경례하기',description:'충성! 상멍이와 작은 해군들이 함께 경례해요.'},
  {id:'rescue',label:'구조하기',description:'걱정 마! 상멍이가 구명환으로 작은 해군을 도와줘요.'},
];
export function MascotIllustration() {
 return <svg viewBox="0 0 300 330" aria-hidden="true"><path d="M33 285Q90 262 150 281Q210 262 267 285L266 310Q206 289 150 308Q90 289 34 310Z" fill="#213653"/><path d="M40 276Q90 255 150 274Q210 255 260 276L260 302Q210 281 150 300Q90 281 40 302Z" fill="#fffdf1"/><path d="M107 177Q86 199 82 223Q82 238 96 230L108 215L110 244L88 274Q84 286 100 281L149 260L198 281Q213 286 208 274L187 244L189 215L204 231Q218 238 215 222Q210 196 191 177C221 93 191 57 149 57C101 57 76 95 107 177Z" fill="#ccc" stroke="#b7b7b7" strokeWidth="2"/><path d="M150 234C93 202 124 176 150 192C180 175 208 202 150 234Z" fill="#f4eaea"/><ellipse cx="126" cy="129" rx="3" ry="7" fill="#353535"/><ellipse cx="172" cy="129" rx="3" ry="7" fill="#353535"/><path d="M112 151Q121 162 135 151Q149 139 163 151Q177 162 186 151" fill="none" stroke="#656b70" strokeWidth="2.3" strokeLinecap="round"/><path d="M133 83L143 65M142 88L152 70M130 74L155 80M128 81L151 88" stroke="#aeb3b5" strokeWidth="1.5"/><path d="M116 62L103 31L124 32L146 12L162 38L184 44L170 66Z" fill="#fffdf4" stroke="#718096" strokeWidth="2"/><path d="M124 32L162 38M146 12L146 35" stroke="#718096" strokeWidth="2"/><text x="117" y="53" fill="#233b57" fontSize="21">⚓</text></svg>;
}
export default function StoryScene() {
 const canvas=useRef<HTMLCanvasElement>(null);const [mode,setMode]=useState<SceneMode>('wave');const [paused,setPaused]=useState(false);const [reduced,setReduced]=useState(false);const [state,setState]=useState('loading');
 const controls=useRef<SceneControls>({mode,paused,reduced});
 useEffect(()=>{controls.current={mode,paused,reduced};},[mode,paused,reduced]);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query.matches);change();query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{let dispose:(()=>void)|null=null;let cancelled=false;import('./scene').then(({mountScene})=>{if(cancelled||!canvas.current)return;try{dispose=mountScene(canvas.current,controls);setState(dispose?'ready':'fallback');}catch{setState('fallback');}}).catch(()=>setState('fallback'));return()=>{cancelled=true;dispose?.();};},[]);
 return <div className={styles.scenePanel}>
   <div className={styles.sceneTop}><span><i/> LIVE STORY WORLD</span><span>상멍이의 첫 번째 항해</span></div>
   <div className={styles.sceneArt} data-scene-ready={state==='ready'}>
     <div className={styles.sceneOrbit} aria-hidden="true"/>
     {state!=='ready'&&<div className={styles.fallback}><MascotIllustration/><span>{state==='loading'?'상멍이가 책을 펼치는 중…':'그림으로 만나는 상멍이 · 3D를 지원하지 않는 환경이에요.'}</span></div>}
     <canvas ref={canvas} className={styles.canvas} style={{opacity:state==='ready'?1:0}} role="img" aria-label="펼친 책 위의 3D 상멍이. 하얀 종이 해군 모자, 회색 몸, 분홍 하트와 두 갈래 꼬리지느러미. 작은 해군과 구명환, 날아다니는 책과 새."/>
     <span className={styles.sceneNote}>A little character.<br/><em>A whole new world.</em></span>
   </div>
   <div className={styles.sceneControls}>
     <div className={styles.modeButtons} role="group" aria-label="상멍이의 동작">{modes.map(m=><button type="button" key={m.id} aria-pressed={mode===m.id} onClick={()=>setMode(m.id)}>{m.label}<span aria-hidden="true">{m.id==='wave'?'✧':m.id==='salute'?'⚑':'◉'}</span></button>)}</div>
     <button type="button" className={styles.pause} aria-label={paused||reduced?'애니메이션 재생':'애니메이션 일시정지'} aria-pressed={paused||reduced} disabled={reduced} onClick={()=>setPaused(p=>!p)}>{paused||reduced?'▷':'Ⅱ'}</button>
   </div>
   <p className={styles.sceneCaption} aria-live="polite">{modes.find(m=>m.id===mode)?.description}</p>
   <p className={styles.pointerHint}>{reduced?'기기의 동작 줄이기 설정에 따라 정지 화면으로 보여드려요.':'버튼으로 이야기를 바꾸고, 포인터를 움직여 둘러보세요.'}</p>
 </div>;
}
