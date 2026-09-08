"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FlightController } from "./flight-scene";
import styles from "./flight.module.css";
import SpeciesNavigator from "./SpeciesNavigator";
import { WHALE_SPECIES, type FlightView, type SpeciesOrder, type WhaleSpeciesId } from "./species";

const chapters = [
  { number: "01", title: "구름 너머, 고비비", line: "하늘이 바다가 되는 순간." },
  { number: "02", title: "거대한 숨결 사이로", line: "고래들의 길을 따라 날아보세요." },
  { number: "03", title: "햇살을 가르는 지느러미", line: "구름 사이로, 거대한 날갯짓." },
  { number: "04", title: "우리의 비상은 계속된다", line: "이곳에서는 상상도 함께 헤엄칩니다." },
];

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
  const [stage, setStage] = useState(0);
  const [credits, setCredits] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<WhaleSpeciesId>("blue");
  const [view, setView] = useState<FlightView>("flight");
  const [order, setOrder] = useState<SpeciesOrder>("size");
  const chapter = chapters[stage] || chapters[0];

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
          onStage: value => { if (!disposed) setStage(value); },
          onSpecies: value => { if (!disposed) setActive(value); },
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
    controller.current?.setSpeciesOrder(order);
    controller.current?.setViewMode(view);
  }, [order, view, ready]);

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
    if (paused && reduced) { controller.current?.setReducedMotion(false); setNotice("직접 재생을 선택했습니다. 언제든 일시정지할 수 있습니다."); }
    setPaused(value => !value);
  }
  async function toggleSound() {
    if (sound) { await ambient.current?.context.suspend(); setSound(false); return; }
    try { ambient.current ??= createAmbient(); await ambient.current.context.resume(); setSound(true); } catch { setNotice("이 브라우저에서는 소리를 켤 수 없습니다."); }
  }
  function retry() { setReady(false); setError(""); setPaused(true); setSound(false); setAttempt(value => value + 1); }

  return <main className={styles.experience} data-ready={ready} data-paused={paused} data-edition="ten-species" data-view={view} aria-label="고래들의 비상 — 고비비 실시간 3D 체험">
    <div className={styles.poster} aria-hidden="true" />
    <canvas key={attempt} ref={canvas} className={styles.canvas} role="img" aria-label="대왕고래부터 큰돌고래까지 서로 다른 고래류 10종의 실시간 3D 수영" onPointerMove={event => {
      if (!paused && event.pointerType !== "touch") { const bounds = event.currentTarget.getBoundingClientRect(); controller.current?.setPointer((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1); }
    }} onPointerLeave={() => controller.current?.setPointer(0, 0)} />
    <div className={styles.shade} aria-hidden="true" />
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="GOBIBI 홈페이지로 나가기">GOBIBI <small>× SANG#MUNG</small></Link>
      <span className={styles.edition}>A SKY WITHOUT LIMITS</span>
      <Link href="/" className={styles.exit} aria-label="체험 나가기">나가기 <span aria-hidden="true">↗</span></Link>
    </header>

    {!ready && !error && <div className={styles.loading} role="status"><span className={styles.orbit} aria-hidden="true" /><p>고비비의 하늘을 여는 중</p><small>서로 다른 고래 10종이 곧 도착합니다.</small></div>}
    {error && <section className={styles.failure} role="alert"><span>잠시, 구름 사이에서</span><h1>하늘을 열지 못했어요.</h1><p>{error}</p><button type="button" onClick={retry}>다시 시도</button><Link href="/">고비비 홈으로</Link></section>}

    {ready && !error && <>
      {view === "flight" && <div className={styles.chapter} aria-hidden="true"><span>{chapter.number} / 04</span><i /><p>{chapter.title}</p></div>}
      <section className={styles.title}>
        <p className={styles.eyebrow}>THE ASCENT OF WHALES</p>
        <h1>고래들의 비상</h1>
        <p className={styles.tagline}>{view === "compare" ? "서로 다른 열 가지 숨결, 같은 크기의 자로." : "10종의 고래와 함께, 하늘이 바다가 되는 순간."}</p>
      </section>
      <SpeciesNavigator active={active} order={order} view={view} onSelect={id => { setActive(id); controller.current?.focusSpecies(id); }} onOrder={setOrder} onView={setView} />
      {paused && <div className={styles.pauseMessage}><button type="button" onClick={togglePlay} className={styles.resume} aria-label="비행 시작"><span aria-hidden="true">▷</span> {reduced ? "움직임 켜고 함께 날기" : "다시 함께 날기"}</button><p>{reduced ? "기기의 움직임 줄이기 설정을 존중해 멈춰 두었습니다." : "잠시 멈춘 하늘. 준비되면 다시 날아보세요."}</p></div>}
      <footer className={styles.footer}>
        <div className={styles.hint}><span className={styles.dot} />실시간 3D 비행<small>고래류 10종 · 구름 위의 여행</small></div>
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
      <p>서로 다른 고래류 10종의 수영 동작을 고비비 하늘에 펼친 실시간 3D 작품입니다. 사전 녹화 영상이나 정밀한 자연 다큐멘터리는 아닙니다.</p>
      <p>대왕고래·향고래·혹등고래·범고래·큰돌고래는 원작자의 스킨 애니메이션 모델입니다. 참고래·귀신고래·밍크고래·일각고래·흰고래는 종별 체형·지느러미·무늬를 반영해 직접 모델링한 3D 표현입니다. 촬영·스캔 모델은 아닙니다.</p>
      <p>크기 비교는 같은 거리·동일 축척으로 보여줍니다. 표시 길이는 연출용 대표 몸길이이며 종의 평균이나 최대 기록이 아닙니다. 실제 크기는 성별·지역에 따라 다르고, 일각고래의 엄니는 몸길이에 포함하지 않습니다. ‘유명한 종 먼저’는 대중에게 잘 알려진 종 중심의 편집상 소개순이며 객관적인 인기 순위는 아닙니다.</p>
      <p>3D 고래: <a href="https://sketchfab.com/3d-models/blue-whale-textured-d24d19021c724c3a9134eebcb76b0e0f" target="_blank" rel="noreferrer">Blue Whale – Textured / Bohdan Lvov</a><br /><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> · 크기·비행 경로·조명 연출 적용</p>
      <p>향고래·혹등고래: Bohdan Lvov<br />범고래: Abner Wu / Trouvaille<br />큰돌고래: Alex_Pfe<br />모두 CC BY 4.0 · 일부 텍스처 최적화·비행·조명 연출 적용. 원작 링크는 아래 전체 고지에서 확인할 수 있습니다.</p>
      <details><summary>10종 몸길이 참고 자료 · 2026-09-08 확인</summary>{WHALE_SPECIES.map(item => <p key={item.id}><a href={item.source} target="_blank" rel="noreferrer">{item.name} · {item.length}m ↗</a><br />{item.lengthNote}</p>)}</details>
      <p>배경 원화: GOBIBI × SANG#MUNG<br />사운드: 브라우저 합성 앰비언스 · 기본 음소거</p><a href="/whale-flight/credits.txt" target="_blank" rel="noreferrer">전체 제작·라이선스 정보 ↗</a>
    </section>}
    <p role="status" className={notice ? styles.notice : styles.srOnly}>{notice}</p>
    <noscript><p className={styles.noScript}>3D 체험에는 JavaScript가 필요합니다. <Link href="/">고비비 홈으로 돌아가기</Link></p></noscript>
  </main>;
}
