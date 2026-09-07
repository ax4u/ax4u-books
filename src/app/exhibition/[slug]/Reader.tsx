"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";
import styles from "./reader.module.css";

type Lens = { x: number; y: number; src: string; width: number; height: number; px: number; py: number };

type Turn = { from: number; to: number; direction: "forward" | "reverse"; ready: boolean };

export default function Reader({ book }: { book: ExhibitionBook }) {
  // Virtual endpapers live only here: the catalog remains cover + original body pages.
  const spreads: [number | null, number | null][] = [[null, 0], [null, 1]];
  for (let p = 2; p < book.pages.length; p += 2) spreads.push([p, p + 1 < book.pages.length ? p + 1 : null]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [magnify, setMagnify] = useState(false);
  const [lens, setLens] = useState<Lens | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const last = spreads.length - 1;
  const target = turn?.to;

  // Decode just the destination before lifting a leaf, not the entire original book.
  useEffect(() => {
    if (target === undefined) return;
    let cancelled = false;
    const indices = target === 0 ? [0] : target === 1 ? [1] : [target * 2 - 2, target * 2 - 1];
    const ready = () => { if (!cancelled) setTurn(t => t ? { ...t, ready: true } : null); };
    const timer = setTimeout(ready, 5000);
    Promise.all(indices.filter(p => p < book.pages.length).map(p => {
      const image = new Image(); image.src = book.pages[p].src;
      return image.decode().catch(() => undefined);
    })).then(ready);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [target, book.pages]);

  useEffect(() => {
    if (!turn) return;
    const finish = () => { setIndex(turn.to); setTurn(null); locked.current = false; };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (media.matches) finish(); };
    media.addEventListener("change", changed);
    // Fallback if animationend is suppressed by a hidden tab or browser interruption.
    const timer = turn.ready ? setTimeout(finish, 1100) : undefined;
    return () => { clearTimeout(timer); media.removeEventListener("change", changed); };
  }, [turn]);

  function show(next: number, chosen?: number) {
    if (locked.current) return;
    setLens(null);
    const bounded = Math.max(0, Math.min(last, next));
    setSelected(chosen ?? spreads[bounded].find(p => p !== null) ?? 0);
    if (bounded === index) return;
    setFailed(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setIndex(bounded); return; }
    locked.current = true;
    setTurn({ from: index, to: bounded, direction: bounded > index ? "forward" : "reverse", ready: false });
  }
  function finishTurn() {
    if (!turn?.ready) return;
    setIndex(turn.to); setTurn(null); locked.current = false;
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).matches('input, select, textarea, [contenteditable="true"]')) return;
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, PageDown: index + 1, PageUp: index - 1, Home: 0, End: last };
    if (Object.hasOwn(keys, event.key)) { event.preventDefault(); show(keys[event.key]); }
    if (event.key === "Escape") { setMagnify(false); setLens(null); setZoom(100); }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!magnify || turn || event.pointerType === "touch") return;
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || !stage.current) { setLens(null); return; }
    const rect = target.getBoundingClientRect(), outer = stage.current.getBoundingClientRect();
    const scale = Math.min(rect.width / target.naturalWidth, rect.height / target.naturalHeight);
    const width = target.naturalWidth * scale, height = target.naturalHeight * scale;
    const px = event.clientX - rect.left - (rect.width - width) / 2, py = event.clientY - rect.top - (rect.height - height) / 2;
    if (px < 0 || py < 0 || px > width || py > height) { setLens(null); return; }
    setLens({ x: Math.max(76, Math.min(outer.width - 76, event.clientX - outer.left)), y: event.clientY - outer.top, src: target.currentSrc, width, height, px, py });
  }
  function image(p: number | null) {
    if (p === null) return null;
    const page = book.pages[p];
    // Originals are served directly, with their native ratio preserved by contain.
    // eslint-disable-next-line @next/next/no-img-element
    return <img key={`${p}-${retry}`} data-page-image data-source-page={p} src={page.src} alt={`${book.title} — ${page.label}`} width={page.width} height={page.height} draggable={false} decoding="async" onError={() => setFailed(true)} className={styles.page} />;
  }
  const current = spreads[index];
  const destination = spreads[turn?.to ?? index];
  const forward = turn?.direction === "forward";
  const left = turn?.ready && !forward ? destination[0] : current[0];
  const right = turn?.ready && forward ? destination[1] : current[1];
  const label = index === 0 ? "앞표지" : index === 1 ? "본문 1쪽" : `본문 ${current[0]}${current[1] === null ? "" : `–${current[1]}`}쪽`;
  return <section aria-label="그림책 읽기" aria-describedby="reader-help" tabIndex={0} onKeyDown={onKeyDown} className={styles.reader}>
    <div data-page-stage className={styles.stage} ref={stage} onPointerMove={move} onPointerLeave={() => setLens(null)}
      onTouchStart={event => { touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={event => {
        const start = touch.current; touch.current = null;
        if (!start || zoom !== 100 || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1));
      }}>
      <div className={styles.viewport} onScroll={() => setLens(null)}>
      <div data-book-spread data-gallery-book data-closed={index === 0 && !turn} data-turning={turn?.direction ?? "idle"} aria-busy={!!turn} className={styles.book} onPointerDown={event => { if (event.pointerType !== "mouse" || magnify || zoom !== 100) return; drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerCancel={() => { drag.current = null; }}
        onPointerUp={event => { const start = drag.current; drag.current = null; if (!start) return; const dx = event.clientX - start.x, dy = event.clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1)); }}
        style={{ "--zoom": zoom / 100, "--spread-ratio": `${book.pages[0].width * 2} / ${book.pages[0].height}`, "--spread-width": `${book.pages[0].width * 2 / book.pages[0].height * 62}dvh` } as CSSProperties}>
        <div data-spread-side="left" data-blank={left === null} className={`${styles.sheet} ${styles.left} ${index === 0 && !turn ? styles.absent : ""}`}>{image(left)}</div>
        <div data-spread-side="right" data-blank={right === null} className={`${styles.sheet} ${styles.right}`}>{image(right)}</div>
        <div className={styles.spine} aria-hidden="true" />
        {turn?.ready && <div data-turn-leaf data-turning-leaf aria-hidden="true" className={`${styles.leaf} ${forward ? styles.forward : styles.reverse}`} onAnimationEnd={event => { if (event.target === event.currentTarget) finishTurn(); }}>
          <div data-leaf-face="front" className={`${styles.face} ${styles.front}`}>{image(forward ? current[1] : current[0])}</div>
          <div data-leaf-face="back" className={`${styles.face} ${styles.back}`}>{image(forward ? destination[0] : destination[1])}</div>
        </div>}
      </div>
      </div>
      {lens && magnify && !turn && <div data-magnifier aria-hidden="true" className={styles.lens} style={{ left: lens.x, top: lens.y, backgroundImage: `url("${lens.src}")`, backgroundSize: `${lens.width * 2.5}px ${lens.height * 2.5}px`, backgroundPosition: `${76 - lens.px * 2.5}px ${76 - lens.py * 2.5}px` }} />}
      {failed && <div className={styles.error} role="alert">이미지를 불러오지 못했습니다. <button type="button" onClick={() => { setFailed(false); setRetry(retry + 1); }}>다시 시도</button></div>}
    </div>
    <progress aria-label="읽기 진행" max={book.pages.length} value={Math.max(...current.filter((p): p is number => p !== null)) + 1} className={styles.progress} />
    <nav aria-label="페이지 이동" className={styles.controls}>
      <button type="button" aria-label="이전 페이지" disabled={!!turn || index === 0} onClick={() => show(index - 1)}>← 이전</button>
      <output role="status" aria-live="polite" aria-atomic="true">{label} · 펼침 {index + 1} / {spreads.length}</output>
      <button type="button" aria-label="다음 페이지" disabled={!!turn || index === last} onClick={() => show(index + 1)}>다음 →</button>
    </nav>
    <div className={styles.tools} aria-label="읽기 도구">
      <button type="button" aria-label="축소" disabled={zoom === 100 || !!turn} onClick={() => { setZoom(zoom - 25); setLens(null); }}>−</button>
      <span aria-label={`배율 ${zoom}%`}>{zoom}%</span>
      <button type="button" aria-label="확대" disabled={zoom === 200 || !!turn} onClick={() => { setZoom(zoom + 25); setLens(null); }}>＋</button>
      <button type="button" aria-pressed={magnify} disabled={!!turn} onClick={() => { setMagnify(!magnify); setLens(null); }}>돋보기</button>
      <label className={styles.select}>페이지 선택 <select aria-label="페이지 선택" disabled={!!turn} value={selected} onChange={event => { const p = Number(event.target.value); show(p === 0 ? 0 : Math.floor(p / 2) + 1, p); }}>{book.pages.map((p, i) => <option key={p.src} value={i}>{p.label}</option>)}</select></label>
    </div>
    <p id="reader-help" className={styles.help}>짝수 쪽은 왼쪽, 홀수 쪽은 오른쪽에 펼쳐집니다. 좌우로 밀거나 이전·다음 버튼, 방향키, Home·End 키로 넘겨 보세요. 돋보기로 그림을 살펴보거나 + 버튼으로 확대해 보세요. Escape 키로 배율을 초기화할 수 있습니다.</p>
    <noscript><p>페이지 넘기기는 JavaScript가 필요합니다. 아래에서 각 원본 페이지를 열 수 있습니다.</p>{book.pages.map(p => <a key={p.src} href={p.src} className="mr-4 inline-block underline">{p.label}</a>)}</noscript>
  </section>;
}
