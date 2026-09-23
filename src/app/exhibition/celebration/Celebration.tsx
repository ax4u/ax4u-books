'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './celebration.module.css';

type Artwork = { src: string; width: number; height: number; title: string; author: string; slug: string };
type Music = { src: string; title: string; credit: string; source: string; license: string };

export default function Celebration({ names, artwork, music }: { names: string[]; artwork: Artwork[]; music: Music }) {
  const screen = useRef<HTMLElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const reveal = useRef<HTMLButtonElement>(null);
  const hideButton = useRef<HTMLButtonElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const [hidden, setHidden] = useState(false);
  const [full, setFull] = useState(false);
  const [motion, setMotion] = useState(true);
  const [scene, setScene] = useState(0);
  const [notice, setNotice] = useState('시작 버튼을 누르면 음악과 함께 축하 화면이 시작됩니다.');

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    const change = () => setFull(Boolean(document.fullscreenElement));
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches('input, textarea, select')) return;
      if (e.key.toLowerCase() === 'h') setHidden(value => !value);
      if (e.key === 'Escape') setHidden(false);
    };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!started || !motion || preference.matches) return;
    const timer = window.setInterval(() => setScene(value => (value + 1) % 2), 24000);
    return () => window.clearInterval(timer);
  }, [started, motion]);

  async function play() {
    if (!audio.current) return;
    try {
      await audio.current.play();
      setNotice('음악과 함께, 새로운 이야기를 축하해요.');
    } catch {
      setNotice('음악을 재생하지 못했어요. 음악 재생 버튼을 다시 눌러 주세요.');
    }
  }
  function start() {
    setStarted(true);
    void play();
  }
  function stop() {
    if (!audio.current) return;
    audio.current.pause();
    audio.current.currentTime = 0;
    setNotice('음악이 정지되었습니다.');
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (screen.current?.requestFullscreen) await screen.current.requestFullscreen();
      else setNotice('이 브라우저는 전체화면을 지원하지 않습니다. 가로 화면으로 감상해 주세요.');
    } catch {
      setNotice('전체화면을 열지 못했어요. 브라우저의 전체화면 기능을 이용해 주세요.');
    }
  }
  function hide() {
    setHidden(true);
    requestAnimationFrame(() => reveal.current?.focus({ preventScroll: true }));
  }
  function show() {
    setHidden(false);
    requestAnimationFrame(() => hideButton.current?.focus({ preventScroll: true }));
  }

  return (
    <main ref={screen} className={`${styles.screen} ${hidden ? styles.clean : ''}`}>
      <div className={styles.stage} aria-label="그림책 출판 축하 전시" data-scene={scene} data-started={started}>
        <div className={styles.collage} aria-hidden="true">
          {Array.from({ length: 8 }, (_, tile) => (
            <div key={tile} className={styles.frame}>
              {[0, 1].map(layer => {
                const art = artwork[(tile + layer * 4) % artwork.length];
                return art ? <Image key={layer} src={art.src} alt="" width={art.width} height={art.height}
                  className={`${styles.art} ${scene === layer ? styles.active : ''}`} unoptimized loading="eager" /> : null;
              })}
            </div>
          ))}
        </div>
        <div className={styles.wash} />
        <div className={styles.edition}>GOBIBI <span>작은 작가들의 빛나는 첫걸음</span></div>
        <div className={styles.message}>
          <p className={styles.kicker}><span /> A NEW CHAPTER BEGINS <span /></p>
          <h1>그림책 출판을 축하합니다</h1>
          <div className={styles.flower} aria-hidden="true">✳</div>
          <ul className={styles.names}>{names.map(name => <li key={name}>{name}</li>)}</ul>
          <p className={styles.dedication}>작은 상상이 한 권의 책으로,<br />여러분의 이야기가 세상에 피어났습니다.</p>
        </div>
        <div className={styles.signature}>이야기의 시작을 함께 축하하며 <span>GOBIBI</span></div>
        <p className={styles.artCredit}>배경 삽화 · 김도연 「보리의 첫 물놀이」</p>
      </div>

      <audio ref={audio} src={music.src} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => { setPlaying(false); setNotice('음악을 불러오지 못했어요. 화면은 계속 감상할 수 있습니다.'); }} />
      {!hidden && <div className={styles.controls}>
        <nav className={styles.toolbar} aria-label="축하 화면 컨트롤">
          <Link href="/exhibition" className={styles.back}>← 전시관</Link>
          {!started && <button type="button" onClick={start} className={styles.start}>축하 화면 시작 <span aria-hidden="true">▶</span></button>}
          {started && <button type="button" onClick={playing ? () => audio.current?.pause() : play}>{playing ? '음악 일시정지' : '음악 재생'}</button>}
          <button type="button" onClick={stop} disabled={!started}>음악 정지</button>
          <label className={styles.volume}>음량 <input aria-label="음량" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => setVolume(Number(event.target.value))} /><output>{Math.round(volume * 100)}%</output></label>
          <button type="button" aria-pressed={!motion} onClick={() => setMotion(value => !value)}>{motion ? '화면 전환 멈춤' : '화면 전환 켜기'}</button>
          <button type="button" onClick={fullscreen}>{full ? '전체화면 종료' : '전체화면'}</button>
          <button ref={hideButton} type="button" onClick={hide}>컨트롤 숨김</button>
        </nav>
        <div className={styles.notes}>
          <p role="status">{notice} <span>H: 컨트롤 숨김·표시 / Esc: 표시</span></p>
          <details><summary>음악·삽화 출처</summary>
            <p>{music.title} · <a href="https://musopen.org/" target="_blank" rel="noreferrer">Musopen</a><br />
              <a href={music.source} target="_blank" rel="noreferrer">{music.license}</a> · 웹 재생용 MP3 변환</p>
            <p>공개 중인 김도연 작가의 「보리의 첫 물놀이」 삽화를 재사용했습니다. 다른 축하 대상의 미공개·철회 작품은 포함하지 않았습니다.</p>
          </details>
        </div>
      </div>}
      {hidden && <button ref={reveal} className={styles.reveal} type="button" onClick={show}>컨트롤 표시 <span>H</span></button>}
    </main>
  );
}
