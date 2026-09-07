"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { ExhibitionBook } from "@/lib/exhibition/catalog";
import styles from "./reader.module.css";

export default function Reader({ book }: { book: ExhibitionBook }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const page = book.pages[index];
  function show(next: number) {
    const bounded = Math.max(0, Math.min(book.pages.length - 1, next));
    if (bounded !== index) { setFailed(false); setIndex(bounded); }
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).matches('input, select, textarea, [contenteditable="true"]')) return;
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, PageDown: index + 1, PageUp: index - 1, Home: 0, End: book.pages.length - 1 };
    if (Object.hasOwn(keys, event.key)) { event.preventDefault(); show(keys[event.key]); }
  }
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
      {/* Only the current original PNG is mounted: no eager full-book download or lossy image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={`${index}-${retry}`} data-page-image src={page.src} alt={`${book.title} — ${page.label}`} width={page.width} height={page.height} draggable={false} decoding="async" onError={() => setFailed(true)} className={styles.page} />
      {failed && <div className={styles.error} role="alert">이미지를 불러오지 못했습니다. <button type="button" onClick={() => { setFailed(false); setRetry(retry + 1); }}>다시 시도</button></div>}
    </div>
    <progress aria-label="읽기 진행" max={book.pages.length} value={index + 1} className={styles.progress} />
    <nav aria-label="페이지 이동" className={styles.controls}>
      <button type="button" aria-label="이전 페이지" disabled={index === 0} onClick={() => show(index - 1)}>← 이전</button>
      <output role="status" aria-live="polite" aria-atomic="true">{page.label} · {index + 1} / {book.pages.length}</output>
      <button type="button" aria-label="다음 페이지" disabled={index === book.pages.length - 1} onClick={() => show(index + 1)}>다음 →</button>
      <label className={styles.select}>페이지 선택 <select aria-label="페이지 선택" value={index} onChange={event => show(Number(event.target.value))}>{book.pages.map((p, i) => <option key={p.src} value={i}>{p.label}</option>)}</select></label>
    </nav>
    <p id="reader-help" className={styles.help}>좌우로 밀거나 이전·다음 버튼으로 넘겨 보세요. 읽기 영역에서 방향키, Home·End 키도 사용할 수 있어요.</p>
    <noscript><p>페이지 넘기기는 JavaScript가 필요합니다. 아래에서 각 원본 페이지를 열 수 있습니다.</p>{book.pages.map(p => <a key={p.src} href={p.src} className="mr-4 inline-block underline">{p.label}</a>)}</noscript>
  </section>;
}
