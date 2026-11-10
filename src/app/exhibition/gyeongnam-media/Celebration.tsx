'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './celebration.module.css';

import { works } from './works';
const coverCount = works.filter(work => work.coverOnly).length;

export default function Celebration() {
  const stage = useRef<HTMLElement>(null);
  const showButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [running, setRunning] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHidden(false); setImmersive(false); }
    };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  useEffect(() => {
    if (!immersive) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [immersive]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (immersive) { setImmersive(false); setNotice(''); return; }
    try {
      if (!stage.current?.requestFullscreen) throw new Error('unsupported');
      await stage.current.requestFullscreen();
      setNotice('');
    } catch {
      setImmersive(true);
      setNotice('브라우저 전체화면 대신 화면 안 크게 보기를 사용합니다.');
    }
  }

  function toggleControls() {
    setHidden(!hidden);
    requestAnimationFrame(() => (hidden ? startButton : showButton).current?.focus());
  }

  return (
    <main ref={stage} className={styles.stage} data-running={running} data-immersive={immersive} data-testid="gn-celebration">
      <div className={styles.topline}><Link href="/exhibition">← 그림책 전시회</Link><span>GYEONGNAM · DIGITAL PICTURE BOOKS</span></div>
      <div className={styles.composition}>
        <header className={styles.intro}>
          <p className={styles.kicker}>경남시청자미디어센터</p>
          <h1>AI 에이전트 활용<br />플립북<span className={styles.subtitle}>(디지털그림책) 만들기</span></h1>
          <div className={styles.shapes} aria-hidden="true"><i /><i /><i /></div>
          <h2>우리의 이야기가<br /><em>책이 된 날.</em></h2>
          <p><Link href="/exhibition/gyeongnam-media/ceremony">축하 세레머니 · 빵빠레와 함께 시작하기</Link></p>
          <p className={styles.message}>한 장의 상상에서, 한 권의 이야기로.<br />여러분의 디지털그림책 출판을 축하합니다.</p>
          <p className={styles.names}>정옥선 · 이연수 · 포근픽 · 복기령<br />전나미 · 별이송송 · 황금복 · 권원주<br />김또이 · 오로라 · Ji-eun Park</p>
          <div className={styles.edition}><span>PUBLICATION<br />CELEBRATION</span><span>서로 다른 이야기<br />완성 플립북 {works.length - coverCount}권<br />표지 전시 {coverCount}작품 · 총 {works.length}작품</span></div>
        </header>
        <section className={styles.artGrid} aria-label="수강생 작품 전시">
          {works.map((work, index) => {
            return <article className={styles.work} key={work.id}>
              <a href={work.coverOnly ? `/exhibition-events/gyeongnam/${work.id}.webp` : `https://heyzine.com/flip-book/${work.id}.html`} target="_blank" rel="noopener noreferrer" aria-label={`${work.title} — ${work.coverOnly ? '표지 보기' : '플립북 보기'} (새 창)`}>
                <div className={styles.cover}><span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><Image unoptimized src={`/exhibition-events/gyeongnam/${work.id}.webp`} alt={`${work.author}의 ${work.title} 표지`} width={work.width} height={work.height} sizes="(max-width: 700px) 44vw, 23vw" priority /></div>
                <div className={styles.caption}><span>{work.author} <small>{work.lesson}</small></span><h3>{work.title}</h3><span className={styles.open}>{work.coverOnly ? '표지 보기 ↗' : '책 펼치기 ↗'}</span></div>
              </a>
            </article>;
          })}
        </section>
      </div>
      <div className={styles.bottomline}><span>각자의 속도로 쓴 이야기, 함께 펼치는 새로운 시작.</span><span>완성책은 플립북, 표지 전시 작품은 표지만 새 창에서 열립니다.</span></div>
      <div className={styles.toolbar} hidden={hidden} aria-label="축하 화면 조작">
        <button ref={startButton} onClick={() => setRunning(!running)} aria-pressed={running}>{running ? '일시정지' : '축하 시작'}</button>
        <button onClick={toggleFullscreen}>{fullscreen || immersive ? '전체화면 나가기' : '전체화면'}</button>
        <button onClick={toggleControls}>조작부 숨기기</button>
        <span>동작 줄이기 설정 시 정적인 화면으로 감상합니다.</span>
      </div>
      <button ref={showButton} className={styles.restore} hidden={!hidden} onClick={toggleControls}>조작부 보기</button>
      <p className={styles.notice} role="status">{notice}</p>
    </main>
  );
}
