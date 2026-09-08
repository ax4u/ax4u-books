"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FlightController } from "./flight-scene";
import styles from "./flight.module.css";

type Ambient = { context: AudioContext; dispose: () => void };
function createAmbient(): Ambient {
  const context = new AudioContext();
  const master = context.createGain(); master.gain.value = 0.065; master.connect(context.destination);
  const nodes: AudioScheduledSourceNode[] = [];
  [130.81, 196, 261.63].forEach((frequency, index) => {
    const tone = context.createOscillator(); tone.type = "sine"; tone.frequency.value = frequency;
    const gain = context.createGain(); gain.gain.value = 0.18 / (index + 1);
    tone.connect(gain).connect(master); tone.start(); nodes.push(tone);
  });
  const noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const samples = noise.getChannelData(0); let last = 0;
  for (let i = 0; i < samples.length; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02; samples[i] = last * 3.5; }
  const wind = context.createBufferSource(); wind.buffer = noise; wind.loop = true;
  const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 450;
  wind.connect(filter).connect(master); wind.start(); nodes.push(wind);
  return { context, dispose: () => { nodes.forEach(node => { try { node.stop(); } catch { /* already stopped */ } }); void context.close().catch(() => {}); } };
}

export default function FlightExperience() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<FlightController | null>(null);
  const ambient = useRef<Ambient | null>(null);
  const pauseRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [sound, setSound] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.current?.dispose(); controller.current = null; setError("하늘을 불러오는 데 시간이 오래 걸립니다. 연결을 확인한 뒤 다시 시도해 주세요."); }, 45000);
    const initialize = async () => {
      try {
        const { createFlightScene } = await import("./flight-scene");
        if (disposed || timedOut || !canvas.current) return;
        setReduced(motion.matches);
        controller.current = createFlightScene(canvas.current, {
          reducedMotion: motion.matches,
          onReady: () => {
            if (disposed || timedOut) return;
            window.clearTimeout(timeout); setReady(true); setPaused(motion.matches);
            try { sessionStorage.removeItem("gobibi.flight.enter"); } catch { /* storage unavailable */ }
          },
          onError: () => { if (!disposed) { window.clearTimeout(timeout); setError("이 환경에서 3D 하늘을 열지 못했습니다. 최신 브라우저에서 하드웨어 가속을 켜거나 다시 시도해 주세요."); setPaused(true); } },
        });
      } catch { if (!disposed) { window.clearTimeout(timeout); setError("3D 화면을 시작하지 못했습니다. 최신 브라우저에서 다시 시도해 주세요."); } }
    };
    void initialize();
    const onMotion = () => { setReduced(motion.matches); controller.current?.setReducedMotion(motion.matches); if (motion.matches) setPaused(true); };
    motion.addEventListener("change", onMotion);
    const onVisibility = () => {
      controller.current?.setPaused(document.hidden || pauseRef.current);
      if (document.hidden) void ambient.current?.context.suspend().catch(() => {});
      // Audio never resumes without a fresh click after leaving the page.
      if (document.hidden) setSound(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true; window.clearTimeout(timeout); motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      controller.current?.dispose(); controller.current = null;
      ambient.current?.dispose(); ambient.current = null;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [attempt]);

  useEffect(() => {
    pauseRef.current = paused;
    controller.current?.setPaused(paused || document.hidden);
    if (paused) void ambient.current?.context.suspend().catch(() => {});
    else if (sound) void ambient.current?.context.resume().catch(() => {});
  }, [paused, sound, ready]);

  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    changed(); document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setNotice("이 브라우저는 전체화면 전환을 지원하지 않아 화면 맞춤 모드로 보여드립니다.");
    } catch { setNotice("전체화면 전환이 제한되어 화면 맞춤 모드로 보여드립니다."); }
  }
  function togglePlay() {
    if (paused && reduced) { controller.current?.setReducedMotion(false); setReduced(false); setNotice(""); }
    setPaused(value => !value);
  }
  async function toggleSound() {
    if (sound) { await ambient.current?.context.suspend(); setSound(false); return; }
    try { ambient.current ??= createAmbient(); await ambient.current.context.resume(); setSound(true); } catch { setNotice("이 브라우저에서는 소리를 켤 수 없습니다."); }
  }
  function retry() { setReady(false); setError(""); setPaused(true); setSound(false); setAttempt(value => value + 1); }

  return <main className={styles.experience} data-ready={ready} data-paused={paused} data-edition="living-pod" aria-label="고래들의 비상 — 고비비 실시간 3D 체험">
    <div className={styles.poster} aria-hidden="true" />
    <canvas key={attempt} ref={canvas} className={styles.canvas} role="img" aria-label="다섯 종 백 마리 고래가 서로를 피하며 깊은 고비비 하늘을 자유롭게 헤엄치는 실시간 3D 장면" onPointerMove={event => {
      if (!paused && event.pointerType !== "touch") { const bounds = event.currentTarget.getBoundingClientRect(); controller.current?.setPointer((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1); }
    }} onPointerLeave={() => controller.current?.setPointer(0, 0)} />
    <div className={styles.shade} aria-hidden="true" />
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="GOBIBI 홈페이지로 나가기">GOBIBI <small>× SANG#MUNG</small></Link>
      <span className={styles.edition}>A SKY WITHOUT LIMITS</span>
      <Link href="/" className={styles.exit} aria-label="체험 나가기">나가기 <span aria-hidden="true">↗</span></Link>
    </header>

    {!ready && !error && <div className={styles.loading} role="status"><span className={styles.orbit} aria-hidden="true" /><p>고비비의 하늘을 여는 중</p><small>백 개의 숨결이 하늘로 모이고 있습니다.</small></div>}
    {error && <section className={styles.failure} role="alert"><span>잠시, 구름 사이에서</span><h1>하늘을 열지 못했어요.</h1><p>{error}</p><button type="button" onClick={retry}>다시 시도</button><Link href="/">고비비 홈으로</Link></section>}

    {ready && !error && <>
      <section className={styles.title}>
        <p className={styles.eyebrow}>THE ASCENT OF WHALES</p>
        <h1>고래들의 비상</h1>
        <p className={styles.tagline}>저마다의 속도로, 끝없이 자유롭게.</p>
      </section>
      {paused && <div className={styles.pauseMessage}><button type="button" onClick={togglePlay} className={styles.resume} aria-label="비행 시작"><span aria-hidden="true">▷</span> {reduced ? "움직임 켜고 함께 날기" : "다시 함께 날기"}</button><p>{reduced ? "기기의 움직임 줄이기 설정을 존중해 멈춰 두었습니다." : "잠시 멈춘 하늘. 준비되면 다시 날아보세요."}</p></div>}
      <footer className={styles.footer}>
        <div className={styles.hint}><span className={styles.dot} />실시간 3D 비행<small>100개의 숨결 · 하나의 하늘</small></div>
        <div className={styles.controls} aria-label="비행 재생 설정">
          <button type="button" onClick={togglePlay} aria-label={paused ? "비행 재생" : "비행 일시정지"} aria-pressed={paused}>{paused ? "▷ 재생" : "Ⅱ 일시정지"}</button>
          <button type="button" onClick={() => void toggleSound()} disabled={paused} aria-label={sound ? "소리 끄기" : "소리 켜기"} aria-pressed={sound}>{sound ? "♪ 소리 켜짐" : "♪ 소리 꺼짐"}</button>
          <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "전체화면 해제" : "전체화면"}>{fullscreen ? "⊡ 화면 복귀" : "⛶ 전체화면"}</button>
          <button type="button" onClick={() => { setCredits(value => !value); if (!credits) setPaused(true); }} aria-label="작품 정보" aria-expanded={credits} aria-controls="flight-credits">ⓘ<span className={styles.srOnly}> 작품 정보</span></button>
        </div>
      </footer>
    </>}
    {credits && <section id="flight-credits" className={styles.credits} aria-label="작품 정보">
      <button type="button" onClick={() => setCredits(false)} aria-label="작품 정보 닫기">닫기 ×</button><h2>고래들의 비상</h2>
      <p>백 개의 숨결이 저마다의 속도로 헤엄치는 실시간 3D 작품입니다.</p>
      <p>3D 모델: Bohdan Lvov · Abner Wu / Trouvaille<br /><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · 일부 텍스처 최적화·조명·군집 연출 적용</p>
      <p>상괭이 원본 모델·배경·연출: GOBIBI × SANG#MUNG<br />사운드: 브라우저 합성 앰비언스 · 기본 음소거</p>
      <p>충돌은 몸과 지느러미의 활동 영역을 감싸는 3D 충돌체로 계산합니다. 질량·관성·반발과 회피를 적용한 실시간 시뮬레이션이며 실제 유체역학의 정밀 재현은 아닙니다.</p>
      <a href="/whale-flight/credits.txt" target="_blank" rel="noreferrer">전체 제작·라이선스 고지 ↗</a>
    </section>}
    <p role="status" className={notice ? styles.notice : styles.srOnly}>{notice}</p>
    <noscript><p className={styles.noScript}>3D 체험에는 JavaScript가 필요합니다. <Link href="/">고비비 홈으로 돌아가기</Link></p></noscript>
  </main>;
}
