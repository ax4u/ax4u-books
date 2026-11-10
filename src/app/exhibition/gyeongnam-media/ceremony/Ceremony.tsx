'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { works } from '../works';
import styles from './ceremony.module.css';

export default function Ceremony() {
  const stage = useRef<HTMLElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const fanfare = useRef<HTMLAudioElement>(null);
  const background = useRef<HTMLAudioElement>(null);
  const backgroundGain = useRef<GainNode | null>(null);
  const generation = useRef(0);
  const startButton = useRef<HTMLButtonElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [fanfarePlaying, setFanfarePlaying] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const [audioNotice, setAudioNotice] = useState('');

  function stop() {
    generation.current++;
    for (const track of [fanfare.current, background.current]) {
      if (track) { track.pause(); track.currentTime = 0; }
    }
    setFanfarePlaying(false);
    setPlaying(false);
  }

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHidden(false); setImmersive(false); }
    };
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('keydown', escape);
    const tracks = [fanfare.current, background.current];
    return () => {
      generation.current++;
      tracks.forEach(track => track?.pause());
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

  function releaseBackground() {
    if (audio.current && backgroundGain.current) {
      const value = backgroundGain.current.gain;
      value.cancelScheduledValues(audio.current.currentTime);
      value.setTargetAtTime(0.85, audio.current.currentTime, 0.5);
    }
    setFanfarePlaying(false);
  }

  function audioFailure() {
    stop();
    setAudioNotice('음원을 재생하지 못했습니다. 연결과 기기 음량을 확인한 뒤 다시 눌러주세요.');
  }

  async function play() {
    const current = ++generation.current;
    setAudioNotice('');
    try {
      if (!audio.current) {
        audio.current = new AudioContext();
        gain.current = audio.current.createGain();
        gain.current.connect(audio.current.destination);
        backgroundGain.current = audio.current.createGain();
        backgroundGain.current.connect(gain.current);
        audio.current.createMediaElementSource(background.current!).connect(backgroundGain.current);
        audio.current.createMediaElementSource(fanfare.current!).connect(gain.current);
      }
      const ctx = audio.current;
      gain.current!.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.015);
      const bg = backgroundGain.current!.gain;
      bg.cancelScheduledValues(ctx.currentTime);
      bg.setTargetAtTime(0.07, ctx.currentTime, 0.025);
      fanfare.current!.currentTime = 0;
      // Start both media elements and resume directly in the user's click.
      const pending = Promise.all([ctx.resume(), fanfare.current!.play(), background.current!.play()]);
      setStarted(true);
      setPlaying(true);
      setFanfarePlaying(true);
      if (!started && !document.fullscreenElement && !immersive) void enterFullscreen();
      await pending;
      if (current !== generation.current) return;
      if (ctx.state !== 'running') throw new Error('Audio suspended');
    } catch {
      if (current === generation.current) audioFailure();
    }
  }

  function toggleControls() {
    setHidden(!hidden);
    requestAnimationFrame(() => (hidden ? startButton : restoreButton).current?.focus());
  }

  return <main ref={stage} className={styles.stage} data-testid="gn-ceremony" data-playing={playing} data-immersive={immersive}>
    <audio ref={fanfare} data-track="fanfare" src="/exhibition-events/gyeongnam/fanfare-space.mp3" preload="none" onEnded={releaseBackground} onError={audioFailure} />
    <audio ref={background} data-track="background" src="/exhibition-events/gyeongnam/egmont-finale.mp3" preload="none" loop onError={audioFailure} />
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
          if (gain.current && audio.current) gain.current.gain.setTargetAtTime(muted ? volume : 0, audio.current.currentTime, 0.015);
          setMuted(!muted);
        }}>{muted ? '소리 켜기' : '음소거'}</button>
        <button onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => setNotice('전체화면을 나가려면 Esc를 눌러주세요.'));
          else if (immersive) setImmersive(false);
          else void enterFullscreen();
        }}>{fullscreen || immersive ? '전체화면 나가기' : '전체화면'}</button>
        <label className={styles.volume}>음량 {Math.round(volume * 100)}%
          <input aria-label="음량" type="range" min="0" max="1" step="0.01" value={volume} onChange={event => {
            const value = Number(event.target.value);
            setVolume(value);
            if (gain.current && audio.current) gain.current.gain.setTargetAtTime(muted ? 0 : value, audio.current.currentTime, 0.015);
          }} />
        </label>
        <button onClick={toggleControls}>조작부 숨기기</button>
      </div>
      <p>‘축하 시작’ 후 팡파르와 축하 관현악이 재생됩니다. 팡파르 중에는 배경음악이 작아지고, 끝나면 자연스럽게 커져 반복됩니다.</p>
      <p><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300026" target="_blank" rel="noreferrer">Fanfare for Space</a> · <a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200070" target="_blank" rel="noreferrer">Egmont Overture Finale</a> — Kevin MacLeod (incompetech.com) · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · 음량 정규화·끝부분 페이드. Egmont 작곡: Beethoven, 원녹음: MusOpen.</p>
    </div>
    <button ref={restoreButton} className={styles.restore} hidden={!hidden} onClick={toggleControls}>조작부 보기</button>
    <p className={styles.notice} role="status">{audioNotice || notice || (playing ? (muted ? '음악 재생 중 · 음소거' : fanfarePlaying ? '팡파르 재생 중 · 배경음악 자동 낮춤' : '축하 배경음악 반복 재생 중') : started ? '축하의 순간을 다시 만나보세요.' : '')}</p>
  </main>;
}
