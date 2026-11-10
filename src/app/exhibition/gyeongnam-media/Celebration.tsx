'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './celebration.module.css';

const works = [
  { id: 'ca24605388', title: '그 시절, 우리는 참 빛나고 있었다', author: '정옥선', lesson: '글씨 편집본', width: 1050, height: 1400 },
  { id: '1b3e7e3de913', title: '나의 화양연화', author: '이연수', lesson: '4차시', width: 987, height: 1401 },
  { id: 'cce6e31d30', title: '마음습관', author: '포근픽', lesson: '3차시', width: 990, height: 1400 },
  { id: 'f263d5a185', title: '공룡이랑 놀자! ABC 냠냠', author: '복기령', lesson: '3차시', width: 1400, height: 1400 },
  { id: 'fce16ab654', title: '4060, 다시 부르는 우리들의 노래', author: '전나미', lesson: '3차시', width: 989, height: 1400 },
  { id: '8169f469fe', title: '평범한 50대 주부의 성장일기', author: '복기령', lesson: '정식 완간본', width: 1400, height: 990 },
  { id: 'ec22c05071', title: '불이 켜지면 기억이 된다', author: '별이송송 (포구달빛)', lesson: '표지 수정본', width: 1050, height: 1400 },
  { id: 'a09bef66b4', title: '느려도 괜찮아', author: '황금복', lesson: '글씨 확대본', width: 1023, height: 1400 },
  { id: '83c4c7b4a4', title: '바람은 길을 가지고 있지 않아', author: '권원주 (보현화)', lesson: '완본', width: 990, height: 1400 },
];

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
          <p className={styles.message}>한 장의 상상에서, 한 권의 이야기로.<br />여러분의 디지털그림책 출판을 축하합니다.</p>
          <p className={styles.names}>정옥선 · 이연수 · 포근픽 · 복기령<br />전나미 · 별이송송 · 황금복 · 권원주</p>
          <div className={styles.edition}><span>PUBLICATION<br />CELEBRATION</span><span>서로 다른 이야기<br />플립북 {works.length}권</span></div>
        </header>
        <section className={styles.artGrid} aria-label="수강생 작품 전시">
          {works.map((work, index) => {
            return <article className={styles.work} key={work.id}>
              <a href={`https://heyzine.com/flip-book/${work.id}.html`} target="_blank" rel="noopener noreferrer" aria-label={`${work.title} — 플립북 보기 (새 창)`}>
                <div className={styles.cover}><span className={styles.number} aria-hidden="true">0{index + 1}</span><Image unoptimized src={`/exhibition-events/gyeongnam/${work.id}.webp`} alt={`${work.author}의 ${work.title} 표지`} width={work.width} height={work.height} sizes="(max-width: 700px) 44vw, 23vw" priority /></div>
                <div className={styles.caption}><span>{work.author} <small>{work.lesson}</small></span><h3>{work.title}</h3><span className={styles.open}>책 펼치기 ↗</span></div>
              </a>
            </article>;
          })}
        </section>
      </div>
      <div className={styles.bottomline}><span>각자의 속도로 쓴 이야기, 함께 펼치는 새로운 시작.</span><span>표지를 누르면 원본이 새 창에서 열립니다.</span></div>
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
