"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";
import styles from "./mobile-reader.module.css";

type Turn = { from: number; to: number; direction: 1 | -1; progress: number; settling: boolean };
type Drag = { id: number; x: number; y: number; axis: "pending" | "horizontal" | "vertical" };
const facingQuery = "(min-width: 1101px), (orientation: landscape)";
// Same recto/verso contract as the existing desktop reader: cover, blank/1, 2/3, 4/5…
function spread(page: number, count: number): [number | null, number | null] {
  if (page < 2) return [null, page];
  const left = page - page % 2;
  return [left, left + 1 < count ? left + 1 : null];
}
function adjacent(page: number, direction: 1 | -1, wide: boolean, count: number) {
  if (!wide) return Math.max(0, Math.min(count - 1, page + direction));
  const left = page < 2 ? page : page - page % 2;
  const next = direction === 1 ? (left < 2 ? left + 1 : left + 2) : (left <= 2 ? left - 1 : left - 2);
  return next < 0 || next >= count ? page : next;
}

export default function MobileReader({ book }: { book: ExhibitionBook }) {
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState(0); // Absolute original page survives every orientation change.
  const [wide, setWide] = useState(() => window.matchMedia(facingQuery).matches);
  const [zoom, setZoom] = useState(100);
  const [controls, setControls] = useState(true);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const launch = useRef<HTMLButtonElement>(null);
  const pose = useRef<Turn | null>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const generation = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const count = book.pages.length;

  const update = useCallback((next: Turn | null) => { pose.current = next; setTurn(next); }, []);
  const abort = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    drag.current = null;
    update(null);
  }, [update]);
  function finish(commit: boolean) {
    const current = pose.current;
    if (commit && current) setPage(current.to);
    abort();
  }
  function begin(direction: 1 | -1) {
    if (pose.current) return false;
    const to = adjacent(page, direction, wide, count);
    if (to === page) return false;
    setFailed(false);
    update({ from: page, to, direction, progress: 0, settling: false });
    return true;
  }
  function settle(commit: boolean) {
    const current = pose.current;
    if (!current || current.settling) return;
    if (reduceMotion) { finish(commit); return; }
    const token = ++generation.current;
    update({ ...current, settling: true });
    const start = current.progress, target = commit ? 1 : 0;
    const duration = Math.max(100, Math.abs(target - start) * 460);
    let began: number | undefined;
    const tick = (now: number) => {
      if (token !== generation.current || !pose.current) return;
      began ??= now;
      const t = Math.min(1, (now - began) / duration);
      const progress = start + (target - start) * (1 - (1 - t) ** 3);
      update({ ...current, settling: true, progress });
      if (t === 1) finish(commit);
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  function navigate(direction: 1 | -1) { if (begin(direction)) settle(true); }
  function close() {
    abort();
    if (document.fullscreenElement === root.current) void document.exitFullscreen().catch(() => undefined);
    setOpen(false);
  }
  async function toggleFullscreen() {
    if (document.fullscreenElement === root.current) {
      await document.exitFullscreen().catch(() => undefined); return;
    }
    // Only invoked by this button's user gesture. No permissions/protection changes.
    if (document.fullscreenEnabled && root.current?.requestFullscreen) {
      try { await root.current.requestFullscreen(); setNotice(""); return; } catch { /* in-page fallback below */ }
    }
    setControls(false);
    setNotice("이 브라우저에서는 주소창을 숨길 수 없어 화면 안 전체뷰로 읽어요.");
  }

  useEffect(() => {
    const orientation = window.matchMedia(facingQuery);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rotate = () => { abort(); setZoom(100); setWide(orientation.matches); };
    const reduce = () => { setReduceMotion(motion.matches); if (motion.matches) abort(); };
    const hidden = () => { if (document.hidden) abort(); };
    orientation.addEventListener("change", rotate);
    motion.addEventListener("change", reduce);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      abort();
      orientation.removeEventListener("change", rotate); motion.removeEventListener("change", reduce);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [abort]);

  useEffect(() => {
    if (!open || !root.current || !stage.current) { launch.current?.focus(); return; }
    const element = root.current;
    const oldFocus = document.activeElement as HTMLElement | null;
    const siblings = [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== element);
    const inert = siblings.map(el => el.inert);
    siblings.forEach(el => { el.inert = true; });
    const overflow = document.body.style.overflow, htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden"; document.documentElement.style.overflow = "hidden";
    element.focus();
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(stage.current);
    const full = () => setFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", full);
    return () => {
      observer.disconnect(); document.removeEventListener("fullscreenchange", full);
      siblings.forEach((el, i) => { el.inert = inert[i]; });
      document.body.style.overflow = overflow; document.documentElement.style.overflow = htmlOverflow;
      if (oldFocus?.isConnected) oldFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    // A small adjacent-page cache, never eagerly download all 135 pages.
    const pages = new Set<number>();
    for (const direction of [-1, 1] as const) {
      const next = adjacent(page, direction, wide, count);
      for (const p of wide ? spread(next, count) : [next]) if (p !== null) pages.add(p);
    }
    for (const p of pages) { const image = new Image(); image.src = book.pages[p].src; void image.decode().catch(() => undefined); }
  }, [page, wide, count, book.pages]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) { if (drag.current && !pose.current?.settling) finish(false); drag.current = null; return; }
    if (event.button !== 0 || pose.current || zoom !== 100) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: "pending" };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || pose.current?.settling) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (start.axis === "pending" && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      start.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "horizontal" : "vertical";
      if (start.axis === "horizontal") begin(dx < 0 ? 1 : -1);
    }
    if (start.axis !== "horizontal" || !pose.current) return;
    event.preventDefault();
    const distance = -dx * pose.current.direction;
    update({ ...pose.current, progress: Math.max(0, Math.min(.98, distance / Math.max(160, size.width * .7))) });
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (pose.current) settle(!cancelled && pose.current.progress > .16);
    else if (!cancelled && start.axis === "pending" && !controls) { setControls(true); setNotice(""); }
  }
  function image(p: number | null) {
    if (p === null) return null;
    const item = book.pages[p];
    // eslint-disable-next-line @next/next/no-img-element
    return <img key={`${p}-${retry}`} data-source-page={p} src={item.src} alt={`${book.title} — ${item.label}`} width={item.width} height={item.height} draggable={false} decoding="async" onError={() => setFailed(true)} />;
  }
  const current = spread(page, count), destination = spread(turn?.to ?? page, count);
  const forward = turn?.direction !== -1;
  const single = !wide;
  const visible = single ? [page] : current.filter((p): p is number => p !== null);
  // Stable page size: opening the cover must not suddenly halve its width.
  const ratio = book.pages[0].width / book.pages[0].height * (single ? 1 : 2);
  const width = Math.min(size.width - 24, (size.height - 24) * ratio) * zoom / 100;
  const progress = turn?.progress ?? 0;
  const coverOffset = wide ? (turn?.from === 0 ? 1 - progress : turn?.to === 0 ? progress : page === 0 ? 1 : 0) : 0;
  // Reuse the existing CSS 3D two-faced paper. Single-page view tracks the leaf
  // across one page width; at 180deg its correctly oriented reverse fills the slot.
  const shift = !wide ? `${progress * (forward ? 100 : -100)}%` : "0%";
  // Facing pages rotate into the book's depth, keeping the full-height binding
  // fixed. Scaling the entire leaf used to detach its top/bottom from the spine.
  // Portrait keeps its existing travelling single-page gesture.
  const turnScale = wide ? 1 : 1 - (width / 2500 + .02) * Math.sin(Math.PI * progress);
  const angle = (forward ? 1 : -1) * (wide ? 180 : -180) * progress;
  const transform = `translateX(${shift}) rotateY(${angle}deg) scale(${turnScale})`;
  const front = wide ? (forward ? current[1] : current[0]) : page;
  const back = wide ? (forward ? destination[0] : destination[1]) : (turn?.to ?? page);

  return <>
    <div className={styles.launch}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={book.cover.src} alt={`${book.title} 앞표지`} width={book.cover.width} height={book.cover.height} />
      <button ref={launch} type="button" onClick={() => setOpen(true)}>전체뷰로 이어 읽기</button>
      <Link href="/exhibition">전시회 목록으로</Link>
    </div>
    {open && createPortal(<section ref={root} data-mobile-reader="v3-seam" data-layout={wide ? "landscape" : "portrait"} data-current-page={page} data-turning={turn ? (turn.settling ? "settling" : "dragging") : "idle"} data-controls={controls} data-fullscreen={fullscreen ? "native" : "in-page"} role="dialog" aria-modal="true" aria-label={`${book.title} 그림책 독서실`} tabIndex={-1} className={styles.reader}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); if (zoom !== 100) setZoom(100); else close(); return; }
        if (event.key === "Tab") {
          const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), a[href]')].filter(el => el.getClientRects().length);
          const first = items[0], last = items.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if ((event.target as HTMLElement).matches("select, input")) return;
        if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); navigate(1); }
        if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); navigate(-1); }
        if (!pose.current && (event.key === "Home" || event.key === "End")) { event.preventDefault(); setPage(event.key === "Home" ? 0 : count - 1); }
      }}>
      {controls && <header className={styles.header}>
        <button type="button" aria-label="뷰어 닫기" onClick={close}>닫기</button>
        <span title={book.title}>{book.title}</span>
        <button type="button" aria-label="전체화면" aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? "화면 복귀" : "전체화면"}</button>
        <button type="button" aria-label="컨트롤 접기" onClick={() => { abort(); setControls(false); }}>접기</button>
      </header>}
      <div ref={stage} data-mobile-stage data-zoomed={zoom > 100} className={styles.stage} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => pointerUp(event)} onPointerCancel={event => pointerUp(event, true)} onLostPointerCapture={event => pointerUp(event, true)}>
        <div className={styles.canvas}>
        <div data-mobile-book data-single={single} data-closed={wide && page === 0 && !turn} className={styles.book} style={{ width: width > 0 ? width : "100%", height: width > 0 ? width / ratio : "100%", transform: `translateX(${-25 * coverOffset}%)` } as CSSProperties}>
          {single ? <div data-visible-side="single" className={styles.sheet}>{image(turn && !reduceMotion ? null : page)}</div> : <>
            <div data-visible-side="left" className={`${styles.sheet} ${styles.left}`}>{image(turn && !forward ? destination[0] : current[0])}</div>
            <div data-visible-side="right" className={`${styles.sheet} ${styles.right}`}>{image(turn && forward ? destination[1] : current[1])}</div>
            <div className={styles.spine} aria-hidden="true" />
          </>}
          {turn && !reduceMotion && <div data-mobile-leaf aria-hidden="true" className={`${styles.leaf} ${forward ? styles.forward : styles.reverse}`} style={{ transform }}>
            <div data-leaf-face="front" className={`${styles.face} ${styles.front}`}>{image(front)}</div>
            <div data-leaf-face="back" className={`${styles.face} ${styles.back}`}>{image(back)}</div>
          </div>}
        </div>
        </div>
      </div>
      {controls && <div className={styles.tools} aria-label="읽기 도구">
        <button type="button" aria-label="축소" disabled={zoom === 100 || !!turn} onClick={() => setZoom(z => z - 25)}>−</button>
        <button type="button" aria-label="배율 초기화" onClick={() => setZoom(100)}>{zoom}%</button>
        <button type="button" aria-label="확대" disabled={zoom === 200 || !!turn} onClick={() => setZoom(z => z + 25)}>＋</button>
        <span id="reader-help">{zoom > 100 ? "스크롤하여 그림을 살펴보세요 · 배율을 누르면 원래 크기" : "종이를 좌우로 끌어 넘겨요 · 방향키로도 읽을 수 있어요"}</span>
      </div>}
      {controls && <nav className={styles.controls} aria-label="페이지 이동">
        <button type="button" aria-label="이전 페이지" disabled={!!turn || adjacent(page, -1, wide, count) === page} onClick={() => navigate(-1)}>←</button>
        <label>페이지 <select aria-label="페이지 선택" disabled={!!turn} value={page} onChange={event => { abort(); setFailed(false); setPage(Number(event.target.value)); }}>{book.pages.map((p, i) => <option key={p.src} value={i}>{p.label}</option>)}</select></label>
        <output aria-live="polite" role="status">{visible.map(p => p + 1).join("–")} / {count}</output>
        <button type="button" aria-label="다음 페이지" disabled={!!turn || adjacent(page, 1, wide, count) === page} onClick={() => navigate(1)}>→</button>
      </nav>}
      {!controls && <button type="button" className={styles.reveal} aria-label="컨트롤 펼치기" onClick={() => { setControls(true); setNotice(""); }}>메뉴</button>}
      {notice && <p className={styles.notice} role="status" onClick={() => setNotice("")}>{notice}</p>}
      {failed && <div role="alert" className={styles.error}>페이지를 불러오지 못했어요. <button type="button" onClick={() => { setFailed(false); setRetry(retry + 1); }}>다시 시도</button><button type="button" onClick={close}>닫기</button></div>}
    </section>, document.body)}
  </>;
}
