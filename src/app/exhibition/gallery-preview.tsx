"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from "react";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";
import styles from "./gallery.module.css";

type Turn = { from: number; to: number; forward: boolean };
type Lens = { x: number; y: number; src: string; width: number; height: number; px: number; py: number };

export default function GalleryPreview({ book }: { book: ExhibitionBook }) {
  const spreads: [number | null, number | null][] = [[null, 0], [null, 1]];
  for (let p = 2; p < book.pages.length; p += 2) spreads.push([p, p + 1 < book.pages.length ? p + 1 : null]);
  const [index, setIndex] = useState(2);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [zoom, setZoom] = useState(100);
  const [magnify, setMagnify] = useState(false);
  const [lens, setLens] = useState<Lens | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = spreads[index];
  const destination = spreads[turn?.to ?? index];
  const label = index === 0 ? "앞표지" : index === 1 ? "본문 1쪽" : `본문 ${current[0]}${current[1] === null ? "" : `–${current[1]}`}쪽`;
  useEffect(() => {
    if (!turn) return;
    const timer = window.setTimeout(() => { setIndex(turn.to); setTurn(null); locked.current = false; }, 760);
    return () => clearTimeout(timer);
  }, [turn]);
  async function show(next: number) {
    if (locked.current) return;
    const to = Math.max(0, Math.min(spreads.length - 1, next));
    if (to === index) return;
    setLens(null);
    locked.current = true;
    setLoading(true);
    setFailed(false);
    try {
      await Promise.all(spreads[to].filter((p): p is number => p !== null).map(async p => { const img = new Image(); img.src = book.pages[p].src; await img.decode(); }));
    } catch { if (mounted.current) { setFailed(true); setLoading(false); } locked.current = false; return; }
    if (!mounted.current) return;
    setLoading(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setIndex(to); locked.current = false; return; }
    setTurn({ from: index, to, forward: to > index });
  }
  function key(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).matches("select,input,textarea")) return;
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, PageDown: index + 1, PageUp: index - 1, Home: 0, End: spreads.length - 1 };
    if (event.key in keys) { event.preventDefault(); show(keys[event.key]); }
    if (event.key === "Escape") { setMagnify(false); setLens(null); setZoom(100); }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!magnify || turn || loading || event.pointerType === "touch") return;
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
    if (p === null) return <span className={styles.endpaper} aria-label="빈 면지" />;
    const page = book.pages[p];
    // Approved originals only; never crop, rasterize, or request the entire catalog.
    // eslint-disable-next-line @next/next/no-img-element
    return <img data-source-page={p} src={page.src} width={page.width} height={page.height} alt={`${book.title} — ${page.label}`} draggable={false} onError={() => setFailed(true)} />;
  }
  const left = turn && !turn.forward ? destination[0] : current[0];
  const right = turn?.forward ? destination[1] : current[1];
  return <section className={styles.preview} aria-label={`${book.title} 미리보기`} tabIndex={0} onKeyDown={key} aria-describedby="gallery-help">
    <div className={styles.stage} ref={stage} onPointerMove={move} onPointerLeave={() => setLens(null)}>
      <div className={styles.viewport} onScroll={() => setLens(null)}>
        <div data-gallery-book aria-busy={loading || !!turn} data-loading={loading} data-turning={turn ? "true" : "false"} className={styles.book} style={{ "--zoom": zoom / 100 } as CSSProperties}
          onPointerDown={e => { if (e.pointerType !== "mouse" || magnify || zoom !== 100) return; drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerCancel={() => { drag.current = null; }}
          onPointerUp={e => { const start = drag.current; drag.current = null; if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1)); }}
          onTouchStart={e => { touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }}
          onTouchEnd={e => { const start = touch.current; touch.current = null; if (!start || zoom !== 100 || !e.changedTouches.length) return; const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1)); }}>
          <div data-spread-side="left" className={`${styles.sheet} ${styles.left} ${index === 0 && !turn ? styles.absent : ""}`}>{image(left)}</div>
          <div data-spread-side="right" className={`${styles.sheet} ${styles.right}`}>{image(right)}</div>
          <div className={styles.spine} aria-hidden="true" />
          {turn && <div data-turn-leaf aria-hidden="true" className={`${styles.leaf} ${turn.forward ? styles.forward : styles.reverse}`}><div className={styles.front}>{image(turn.forward ? current[1] : current[0])}</div><div className={styles.back}>{image(turn.forward ? destination[0] : destination[1])}</div></div>}
        </div>
      </div>
      {lens && magnify && !turn && <div data-magnifier aria-hidden="true" className={styles.lens} style={{ left: lens.x, top: lens.y, backgroundImage: `url("${lens.src}")`, backgroundSize: `${lens.width * 2.5}px ${lens.height * 2.5}px`, backgroundPosition: `${76 - lens.px * 2.5}px ${76 - lens.py * 2.5}px` }} />}
    </div>
    {failed && <p role="alert">원본을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>}
    <div className={styles.paging}><button type="button" aria-label="이전 페이지" disabled={index === 0 || !!turn} onClick={() => show(index - 1)}>← <span>이전</span></button><output aria-live="polite">{label}<small>펼침 {index + 1} / {spreads.length}</small></output><button type="button" aria-label="다음 페이지" disabled={index === spreads.length - 1 || !!turn} onClick={() => show(index + 1)}><span>다음</span> →</button></div>
    <div className={styles.tools} aria-label="확대 도구"><button type="button" aria-label="축소" disabled={zoom === 100} onClick={() => { setZoom(zoom - 25); setLens(null); }}>−</button><output aria-live="polite">{zoom}%</output><button type="button" aria-label="확대" disabled={zoom === 200} onClick={() => { setZoom(zoom + 25); setLens(null); }}>＋</button><span /><button type="button" aria-pressed={magnify} disabled={!!turn} onClick={() => { setMagnify(!magnify); setLens(null); }}>돋보기</button><label className={styles.jump}>쪽 선택<select aria-label="페이지 선택" disabled={!!turn} value={index} onChange={e => show(Number(e.target.value))}>{spreads.map((s, i) => <option key={i} value={i}>{i === 0 ? "앞표지" : s.filter(p => p !== null).map(p => `${p}쪽`).join(" · ")}</option>)}</select></label></div>
    <p className={styles.help} id="gallery-help">좌우 방향키로 넘기기 · Home 키로 표지 보기<br />돋보기를 켜고 그림 위로 포인터를 움직여 보세요. 터치 화면에서는 + 버튼으로 확대하세요.</p>
  </section>;
}
