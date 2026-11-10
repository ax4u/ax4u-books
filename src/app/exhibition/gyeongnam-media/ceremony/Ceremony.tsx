'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { works } from '../works';
import { fanfare } from './fanfare';
import styles from './ceremony.module.css';

export default function Ceremony() {
  const stage = useRef<HTMLElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const voices = useRef<OscillatorNode[]>([]);
  const generation = useRef(0);
  const startButton = useRef<HTMLButtonElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [audioNotice, setAudioNotice] = useState('');

  function stop() {
    generation.current++;
    voices.current.forEach(node => { try { node.stop(); } catch { /* Already ended. */ } });
    voices.current = [];
    setPlaying(false);
  }

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHidden(false); setImmersive(false); }
    };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('keydown', escape);
    return () => {
      generation.current++;
      void audio.current?.close();
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

  async function enterFullscreen() {
    try {
      if (!stage.current?.requestFullscreen) throw new Error('unsupported');
      await stage.current.requestFullscreen();
      setNotice('');
    } catch {
      setImmersive(true);
      setNotice('전체화면을 지원하지 않아 화면 안 크게 보기로 전환했습니다.');
    }
  }

  async function play() {
    stop();
    const current = generation.current;
    setAudioNotice('');
    try {
      if (!audio.current) {
        audio.current = new AudioContext();
        gain.current = audio.current.createGain();
        gain.current.connect(audio.current.destination);
      }
      // Resume directly in this click handler, before awaiting fullscreen.
      const resumed = audio.current.resume();
      if (!started && !document.fullscreenElement && !immersive) void enterFullscreen();
      await resumed;
      if (current !== generation.current) return;
      if (audio.current.state !== 'running') throw new Error('Audio suspended');
      gain.current!.gain.value = muted ? 0 : 0.7;
      const nodes = fanfare(audio.current, gain.current!);
      voices.current = nodes;
      nodes[nodes.length - 1].addEventListener('ended', () => {
        if (current === generation.current) { setPlaying(false); voices.current = []; }
      });
      setStarted(true);
      setPlaying(true);
    } catch {
      setAudioNotice('소리를 재생하지 못했습니다. 기기 음량과 브라우저 설정을 확인한 뒤 다시 눌러주세요.');
    }
  }

  function toggleControls() {
    setHidden(!hidden);
    requestAnimationFrame(() => (hidden ? startButton : restoreButton).current?.focus());
  }

  return <main ref={stage} className={styles.stage} data-testid="gn-ceremony" data-playing={playing} data-immersive={immersive}>
    <nav className={styles.topline}><Link href="/exhibition/gyeongnam-media">전시로 돌아가기</Link><span>GOBIBI / 경남시청자미디어센터</span></nav>
    <div className={styles.composition}>
      <div className={styles.covers} aria-label="함께 완성한 이야기의 표지">
        {works.map(work => <figure key={work.id}>
          <a href={work.coverOnly ? `/exhibition-events/gyeongnam/${work.id}.webp` : `https://heyzine.com/flip-book/${work.id}.html`} target="_blank" rel="noopener noreferrer" title={`${work.title} — ${work.author}`} aria-label={`${work.title} — ${work.coverOnly ? '표지 보기' : '플립북 보기'} (새 창)`}>
            <Image unoptimized priority src={`/exhibition-events/gyeongnam/${work.id}.webp`} alt={`${work.author}의 ${work.title} 표지`} width={work.width} height={work.height} />
          </a>
        </figure>)}
      </div>
      <header className={styles.message}>
        <div className={styles.shapes} aria-hidden="true"><i /><i /><i /></div>
        <h1>여러분의 그림책 완성을 축하드립니다.</h1>
        <p>한 장의 상상에서, 한 권의 이야기로.</p>
      </header>
    </div>
    <div className={styles.controls} hidden={hidden} aria-label="세레머니 조작">
      <div className={styles.buttons}>
        <button ref={startButton} onClick={play}>{started ? '빵빠레 다시 울리기' : '축하 시작'}</button>
        <button onClick={stop} disabled={!playing}>정지</button>
        <button aria-pressed={muted} onClick={() => {
          if (gain.current && audio.current) gain.current.gain.setTargetAtTime(muted ? 0.7 : 0, audio.current.currentTime, 0.015);
          setMuted(!muted);
        }}>{muted ? '소리 켜기' : '음소거'}</button>
        <button onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => setNotice('전체화면을 나가려면 Esc를 눌러주세요.'));
          else if (immersive) setImmersive(false);
          else void enterFullscreen();
        }}>{fullscreen || immersive ? '전체화면 나가기' : '전체화면'}</button>
        <button onClick={toggleControls}>조작부 숨기기</button>
      </div>
      <p>브라우저 자동재생 제한으로 ‘축하 시작’을 누르면 짧은 빵빠레가 울립니다. 동작 줄이기 설정을 존중합니다.</p>
    </div>
    <button ref={restoreButton} className={styles.restore} hidden={!hidden} onClick={toggleControls}>조작부 보기</button>
    <p className={styles.notice} role="status">{audioNotice || notice || (playing ? (muted ? '빵빠레 재생 중 · 음소거' : '빵빠레 재생 중') : started ? '축하의 순간을 다시 만나보세요.' : '')}</p>
  </main>;
}
