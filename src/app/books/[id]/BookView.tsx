"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/books/types";
import { hasPageImage, pageImageSrc } from "@/lib/books/images";
import { statusLabel } from "@/app/books/status";
import Link from "next/link";
import ui from "@/app/studio.module.css";

// If a generating book hasn't been updated in this long, the serverless run
// likely timed out — nudge it to resume (generation is resumable).
const STALL_MS = 150_000;

export default function BookView({ book }: { book: Book }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageBusy, setPageBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState(book.title ?? "");
  const [draftPages, setDraftPages] = useState<Book["pages"]>(() =>
    [...book.pages].sort((a, b) => a.index - b.index),
  );
  const imagesReady = book.pages.filter(hasPageImage).length;
  const lastSig = useRef(`${book.status}:${imagesReady}`);
  const lastTrigger = useRef(0);

  const active = book.status === "paid" || book.status === "generating";
  const pages = [...book.pages].sort((a, b) => a.index - b.index);

  const triggerGeneration = useCallback(async () => {
    if (Date.now() - lastTrigger.current < STALL_MS) return;
    lastTrigger.current = Date.now();
    await fetch(`/api/books/${book.id}/generate`, { method: "POST" }).catch(
      () => {},
    );
  }, [book.id]);

  // Poll status while generating; refresh on progress, and resume if stalled.
  useEffect(() => {
    if (!active) return;
    const tick = async () => {
      try {
        const res = await fetch(`/api/books/${book.id}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const sig = `${data.status}:${data.imagesReady ?? data.pagesReady}`;
        if (sig !== lastSig.current) {
          lastSig.current = sig;
          router.refresh();
        }
        // Resume a stalled/timed-out run.
        const stale =
          data.updatedAt &&
          Date.now() - new Date(data.updatedAt).getTime() > STALL_MS;
        const incomplete = (data.imagesReady ?? 0) < data.pageCount;
        if (
          incomplete &&
          (data.status === "paid" || (data.status === "generating" && stale))
        ) {
          triggerGeneration();
        }
      } catch {
        // transient — keep polling
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [active, book.id, router, triggerGeneration]);

  // Kick off generation for a freshly paid book.
  useEffect(() => {
    if (book.status === "paid" && book.pages.length === 0) {
      triggerGeneration();
    }
  }, [book.status, book.pages.length, triggerGeneration]);

  const manualRetry = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      lastTrigger.current = 0; // allow immediate retry
      const res = await fetch(`/api/books/${book.id}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "다시 시도 요청에 실패했어요."));
    } finally {
      setStarting(false);
    }
  }, [book.id, router]);

  const saveEdits = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim() || null,
          pages: draftPages.map((page) => ({
            index: page.index,
            text: page.text,
            imagePrompt: page.imagePrompt ?? "",
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "수정 저장에 실패했어요."));
    } finally {
      setSaving(false);
    }
  }, [book.id, draftPages, draftTitle, router]);

  const deleteBook = useCallback(async () => {
    if (!window.confirm("이 그림책을 삭제할까요? 생성된 이미지와 PDF도 삭제됩니다.")) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "그림책 삭제에 실패했어요."));
    }
  }, [book.id, router]);

  const regeneratePage = useCallback(
    async (pageIndex: number) => {
      setPageBusy(pageIndex);
      setError(null);
      try {
        const res = await fetch(
          `/api/books/${book.id}/pages/${pageIndex}/regenerate`,
          { method: "POST" },
        );
        if (!res.ok) throw new Error(await res.text());
        router.refresh();
      } catch (err) {
        setError(errorMessage(err, "그림 재생성 요청에 실패했어요."));
      } finally {
        setPageBusy(null);
      }
    },
    [book.id, router],
  );

  const updateDraftPage = useCallback(
    (pageIndex: number, patch: Partial<Book["pages"][number]>) => {
      setDraftPages((current) =>
        current.map((page) =>
          page.index === pageIndex ? { ...page, ...patch } : page,
        ),
      );
    },
    [],
  );

  const pct =
    book.options.pageCount > 0
      ? Math.round((imagesReady / book.options.pageCount) * 100)
      : 0;

  return (
    <div className={ui.reader}>
      <nav className={ui.readerBreadcrumb} aria-label="현재 위치">
        <Link href="/dashboard" prefetch={false}>← 내 책장</Link>
        <span>GOBIBI READING ROOM</span>
      </nav>
      {error && <div className={ui.errorNotice} role="alert">{error}</div>}

      <header className={ui.bookHeading}>
        <div className={ui.bookHeadingCopy}>
          <p className={ui.eyebrow}>한 권의 상상을 펼치는 곳 · 그림책 상세</p>
          <h1 className={ui.bookTitle}>{book.title || book.topic}</h1>
          <div className={ui.bookMeta}>
            <span className={ui.statusBadge} data-status={book.status}>{statusLabel(book.status)}</span>
            <span className={ui.bookSubject}>주제: {book.topic}</span>
          </div>
          {editing && (
            <label className={ui.field}>
              <span>제목</span>
              <input value={draftTitle} onChange={(event) => setDraftTitle(event.currentTarget.value)} placeholder={book.topic} className={ui.input} />
            </label>
          )}
        </div>
        <div className={ui.editorActions}>
          {editing ? (
            <>
              <button type="button" onClick={saveEdits} disabled={saving} className={ui.primarySmall}>{saving ? "저장 중" : "저장"}</button>
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(book.title ?? "");
                  setDraftPages(pages);
                  setEditing(false);
                }}
                disabled={saving}
                className={ui.secondarySmall}
              >취소</button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(book.title ?? "");
                setDraftPages(pages);
                setEditing(true);
              }}
              className={ui.secondarySmall}
            >편집</button>
          )}
          <button type="button" onClick={deleteBook} className={ui.dangerQuiet}>삭제</button>
        </div>
      </header>

      {editing && <p className={ui.notice}>제목과 각 쪽의 글·이미지 프롬프트를 수정할 수 있어요. 글을 저장하는 것과 그림 재생성은 별도 작업입니다.</p>}

      {book.status === "draft" && (
        <section className={ui.statePanel} data-state="draft" aria-labelledby="draft-title">
          <p className={ui.eyebrow}>BEFORE THE FIRST PAGE</p>
          <h2 id="draft-title">아직 결제를 기다리고 있어요.</h2>
          <p>결제가 확인되면 그림책 제작을 시작합니다. 결제를 마쳤는데 이 상태가 계속된다면 잠시 후 다시 확인해 주세요.</p>
        </section>
      )}

      {(book.status === "paid" || book.status === "generating") && (
        <section className={ui.statePanel} data-state="generating" aria-labelledby="generating-title" role="status" aria-live="polite">
          <p className={ui.eyebrow}>IN THE STORY STUDIO</p>
          <h2 id="generating-title">한 장씩, 이야기를 만들고 있어요.</h2>
          <p>AI가 글과 그림을 생성하고 있어요. 제작 상황에 따라 시간이 걸릴 수 있습니다.</p>
          <div className={ui.progressMeta}><strong>그림 {imagesReady} / {book.options.pageCount}장 완성</strong><span>진행 상황 자동 확인 중</span></div>
          <div className={ui.progressTrack} role="progressbar" aria-label="삽화 생성 진행" aria-valuemin={0} aria-valuemax={book.options.pageCount} aria-valuenow={imagesReady}>
            <div className={ui.progressFill} style={{ width: `${pct}%` }} />
          </div>
        </section>
      )}

      {book.status === "failed" && (
        <section className={ui.statePanel} data-state="failed" aria-labelledby="failed-title">
          <p className={ui.eyebrow}>A PAUSE IN THE STORY</p>
          <h2 id="failed-title">제작 도중, 잠시 멈췄어요.</h2>
          <p>그림책 생성에 실패했어요. 아래 내용을 확인하고 다시 시도해 주세요.</p>
          {book.error && <p className={ui.errorDetail}>{book.error}</p>}
          <button type="button" onClick={manualRetry} disabled={starting} className={ui.primaryButton}>{starting ? "다시 시도 중…" : "다시 시도"}<span aria-hidden="true">↗</span></button>
        </section>
      )}

      {book.status === "completed" && (
        <section className={ui.statePanel} data-state="completed" aria-labelledby="completed-title">
          <p className={ui.eyebrow}>YOUR STORY, NOW A BOOK</p>
          <h2 id="completed-title">한 권의 이야기가 완성됐어요.</h2>
          <p>글과 그림을 천천히 살펴보세요. 필요한 부분을 편집하고 PDF로 간직할 수 있어요.</p>
          <div className={ui.downloadActions}>
            <a href={`/api/books/${book.id}/pdf`} className={ui.primaryButton}>PDF 다운로드 <span aria-hidden="true">↓</span></a>
            <a href={`/printing/${book.id}`} className={ui.secondaryButton}>종이책 인쇄 준비 · 견적 <span aria-hidden="true">↗</span></a>
          </div>
          <p className={ui.fieldHint}>전자책 PDF는 인쇄용 파일이 아닙니다. 종이책 판매·결제·주문·배송은 아직 제공하지 않습니다.</p>
        </section>
      )}

      <section aria-labelledby="book-pages-title" className={ui.pagesSection}>
        <div className={ui.shelfHeading}><h2 id="book-pages-title">{editing ? "이야기 다듬기" : "그림책 펼쳐보기"}</h2><p>{pages.length}쪽</p></div>
        {pages.length === 0 && <div className={ui.pagesEmpty}><span className={ui.placeholderMark} aria-hidden="true">G.</span><p>아직 펼쳐볼 페이지가 없어요.</p><small>위의 제작 상태를 확인해 주세요.</small></div>}
        <div className={ui.pageGrid}>
          {(editing ? draftPages : pages).map((page) => (
            <PageCard
              key={page.index}
              bookId={book.id}
              page={page}
              editing={editing}
              regenerating={pageBusy === page.index}
              onChange={(patch) => updateDraftPage(page.index, patch)}
              onRegenerate={() => regeneratePage(page.index)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PageCard({
  bookId,
  page,
  editing,
  regenerating,
  onChange,
  onRegenerate,
}: {
  bookId: string;
  page: Book["pages"][number];
  editing: boolean;
  regenerating: boolean;
  onChange: (patch: Partial<Book["pages"][number]>) => void;
  onRegenerate: () => void;
}) {
  const src = pageImageSrc(bookId, page);

  return (
    <div className={ui.pageCard}>
      <div className={ui.pageImageFrame}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${page.index + 1}쪽 삽화`}
            loading={page.index === 0 ? "eager" : "lazy"}
            decoding="async"
            className={ui.pageImage}
          />
        ) : (
          <div className={ui.imagePlaceholder}>
            아직 그림이 준비되지 않았어요.
          </div>
        )}
      </div>
      <div className={ui.pageCardBody}>
        <div className={ui.pageCardHeading}>
          <p className={ui.pageNumber}>
            {page.index + 1}쪽
          </p>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className={ui.secondarySmall}
          >
            {regenerating ? "요청 중" : "그림 재생성"}
          </button>
        </div>
        {editing ? (
          <div className={ui.formStack}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>
                본문
              </span>
              <textarea
                value={page.text}
                onChange={(event) =>
                  onChange({ text: event.currentTarget.value })
                }
                rows={4}
                className={ui.input}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>
                이미지 프롬프트
              </span>
              <textarea
                value={page.imagePrompt ?? ""}
                onChange={(event) =>
                  onChange({ imagePrompt: event.currentTarget.value })
                }
                rows={4}
                className={ui.input}
              />
            </label>
          </div>
        ) : (
          <p className={ui.pageText}>{page.text}</p>
        )}
      </div>
    </div>
  );
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) {
    return `${fallback} ${err.message}`;
  }
  return fallback;
}
