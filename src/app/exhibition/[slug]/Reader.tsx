"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";
import styles from "./reader.module.css";

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
    <div data-page-stage className={styles.stage}
      onTouchStart={event => { touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={event => {
        const start = touch.current; touch.current = null;
        if (!start || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(index + (dx < 0 ? 1 : -1));
      }}>
      <div data-book-spread data-turning={turn?.direction ?? "idle"} aria-busy={!!turn} className={styles.book} style={{ "--spread-ratio": `${book.pages[0].width * 2} / ${book.pages[0].height}`, "--spread-width": `${book.pages[0].width * 2 / book.pages[0].height * 62}dvh` } as CSSProperties}>
        <div data-spread-side="left" data-blank={left === null} className={`${styles.sheet} ${styles.left} ${index === 0 && !turn ? styles.absent : ""}`}>{image(left)}</div>
        <div data-spread-side="right" data-blank={right === null} className={`${styles.sheet} ${styles.right}`}>{image(right)}</div>
        <div className={styles.spine} aria-hidden="true" />
        {turn?.ready && <div data-turn-leaf data-turning-leaf aria-hidden="true" className={`${styles.leaf} ${forward ? styles.forward : styles.reverse}`} onAnimationEnd={event => { if (event.target === event.currentTarget) finishTurn(); }}>
          <div data-leaf-face="front" className={`${styles.face} ${styles.front}`}>{image(forward ? current[1] : current[0])}</div>
          <div data-leaf-face="back" className={`${styles.face} ${styles.back}`}>{image(forward ? destination[0] : destination[1])}</div>
        </div>}
      </div>
      {failed && <div className={styles.error} role="alert">이미지를 불러오지 못했습니다. <button type="button" onClick={() => { setFailed(false); setRetry(retry + 1); }}>다시 시도</button></div>}
    </div>
    <progress aria-label="읽기 진행" max={book.pages.length} value={Math.max(...current.filter((p): p is number => p !== null)) + 1} className={styles.progress} />
    <nav aria-label="페이지 이동" className={styles.controls}>
      <button type="button" aria-label="이전 페이지" disabled={!!turn || index === 0} onClick={() => show(index - 1)}>← 이전</button>
      <output role="status" aria-live="polite" aria-atomic="true">{label} · 펼침 {index + 1} / {spreads.length}</output>
      <button type="button" aria-label="다음 페이지" disabled={!!turn || index === last} onClick={() => show(index + 1)}>다음 →</button>
      <label className={styles.select}>페이지 선택 <select aria-label="페이지 선택" disabled={!!turn} value={selected} onChange={event => { const p = Number(event.target.value); show(p === 0 ? 0 : Math.floor(p / 2) + 1, p); }}>{book.pages.map((p, i) => <option key={p.src} value={i}>{p.label}</option>)}</select></label>
    </nav>
    <p id="reader-help" className={styles.help}>짝수 쪽은 왼쪽, 홀수 쪽은 오른쪽에 펼쳐집니다. 좌우로 밀거나 이전·다음 버튼, 방향키, Home·End 키로 넘겨 보세요. 휴대폰을 가로로 돌리거나 두 손가락으로 확대하면 더 크게 볼 수 있어요.</p>
    <noscript><p>페이지 넘기기는 JavaScript가 필요합니다. 아래에서 각 원본 페이지를 열 수 있습니다.</p>{book.pages.map(p => <a key={p.src} href={p.src} className="mr-4 inline-block underline">{p.label}</a>)}</noscript>
  </section>;
}
