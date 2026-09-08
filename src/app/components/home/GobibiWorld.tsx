/* eslint-disable @next/next/no-img-element -- Pre-optimized local WebP sprites and untouched approved book cover; intentionally avoid remote image transforms. */
"use client";
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import Link from 'next/link';
import styles from '../../home.module.css';
import FlightLink from '../gobibi/FlightLink';
import balloonStyles from './WhaleFlightBalloon.module.css';

const lines = ['고비비에 잘 왔어. 무슨 이야기를 가져왔어?', '첫 장이 어렵다면, 나랑 한 줄부터 써보자.', '네 이야기 옆에서 같이 날아갈게.'];
export default function GobibiWorld() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [speech, setSpeech] = useState(0);
  const scene = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const still = paused || reduced;
  useEffect(() => { if (still) { scene.current?.style.setProperty('--px', '0px'); scene.current?.style.setProperty('--py', '0px'); } }, [still]);
  function move(e: PointerEvent<HTMLElement>) {
    if (still || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--px', `${((e.clientX-r.left)/r.width-.5)*12}px`);
    e.currentTarget.style.setProperty('--py', `${((e.clientY-r.top)/r.height-.5)*8}px`);
  }
  return <section id="world" ref={scene} className={styles.world} data-world-scene data-paused={still} onPointerMove={move} onPointerLeave={() => {scene.current?.style.setProperty('--px','0px'); scene.current?.style.setProperty('--py','0px');}} aria-labelledby="hero-title">
    <div className={styles.panorama} data-world-layer><img src="/home/gobibi/world.webp" alt="하늘을 나는 고래와 작은 집, 이야기 작업실이 있는 고비비의 풍경" width="1536" height="1024" fetchPriority="high" className={styles.worldImage}/></div>
    <div className={styles.worldBrand} aria-hidden="true">GOBIBI</div>
    <div className={styles.heroCopy}><p className={styles.eyebrow}>A LITTLE WORLD. A BIG IMAGINATION.</p><h1 id="hero-title">고래가 나는 곳,<br/>이야기가 태어나는 곳.</h1><p>고래들의 이상향, 고비비.<br/>상멍이와 함께 당신의 첫 장을 펼쳐요.</p></div>
    <div className={`${styles.skyWhale} ${styles.whaleOne}`} aria-hidden="true"><img src="/home/gobibi/whale.webp" alt="" width="1375" height="555" onError={e=>{e.currentTarget.style.visibility='hidden';}}/></div>
    <div className={`${styles.skyWhale} ${styles.whaleTwo}`} aria-hidden="true"><img src="/home/gobibi/whale.webp" alt="" width="1375" height="555" onError={e=>{e.currentTarget.style.visibility='hidden';}}/></div>
    <span className={`${styles.cloud} ${styles.cloudOne}`} aria-hidden="true"/><span className={`${styles.cloud} ${styles.cloudTwo}`} aria-hidden="true"/>
    <nav className={styles.mapPlaces} aria-label="고비비 지도 속 장소">
      <FlightLink className={`${styles.hotspot} ${balloonStyles.balloon}`} data-whale-balloon aria-label="고래들의 비상 체험 열기"><span className={styles.mapDot} aria-hidden="true"/>고래들의 비상 <span aria-hidden="true">↗</span></FlightLink>
      <Link href="#sangmung" className={`${styles.hotspot} ${styles.house}`}><span className={styles.mapDot} aria-hidden="true"/>상멍이의 집 <span aria-hidden="true">↗</span></Link>
      <Link href="#studio" className={`${styles.hotspot} ${styles.studioPin}`}><span className={styles.mapDot} aria-hidden="true"/>이야기 작업실 <span aria-hidden="true">↗</span></Link>
      <Link href="/exhibition" className={`${styles.hotspot} ${styles.galleryPin}`}><span className={styles.mapDot} aria-hidden="true"/>그림책 전시관 <span aria-hidden="true">↗</span></Link>
    </nav>
    <div className={styles.mascotVisitor}>
      <p className={styles.speech} aria-live="polite" aria-atomic="true" data-sangmung-speech>{lines[speech%lines.length]}</p>
      <button type="button" className={styles.mascotButton} aria-label="상멍이에게 인사하기" onClick={()=>setSpeech(s=>s+1)}><span key={speech} className={speech ? styles.wave : undefined}><img className={styles.mascotFloat} src="/home/gobibi/sangmung.webp" alt="종이 모자와 분홍 하트를 지닌 고비비의 친구 상멍이" width="787" height="1267"/></span></button>
      <span className={styles.tapHint}>상멍이를 톡, 눌러봐!</span>
    </div>
    <div className={styles.sceneBottom}><span>WELCOME TO OUR WHALE UTOPIA <i aria-hidden="true">↓</i></span><button type="button" data-scene-toggle aria-pressed={still} disabled={reduced} onClick={()=>setPaused(p=>!p)}>{reduced ? '동작 줄이기 적용 중' : paused ? '풍경 움직임 재생' : '풍경 움직임 멈추기'} <span aria-hidden="true">{still ? '▷' : 'Ⅱ'}</span></button></div>
  </section>;
}
