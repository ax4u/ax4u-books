"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/books/types";
import { hasPageImage, pageImageSrc } from "@/lib/books/images";
import { statusLabel, statusClass } from "@/app/books/status";

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
    <div>
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-500">
                제목
              </span>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.currentTarget.value)}
                placeholder={book.topic}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-xl font-bold dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          ) : (
            <h1 className="text-2xl font-bold">{book.title || book.topic}</h1>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(book.status)}`}
            >
              {statusLabel(book.status)}
            </span>
            <span className="text-sm text-zinc-500">주제: {book.topic}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={saveEdits}
                disabled={saving}
                className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving ? "저장 중" : "저장"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(book.title ?? "");
                  setDraftPages(pages);
                  setEditing(false);
                }}
                disabled={saving}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(book.title ?? "");
                setDraftPages(pages);
                setEditing(true);
              }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              편집
            </button>
          )}
          <button
            type="button"
            onClick={deleteBook}
            className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            삭제
          </button>
        </div>
      </div>

      {(book.status === "paid" || book.status === "generating") && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            AI가 그림책을 만들고 있어요…
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            그림 {imagesReady} / {book.options.pageCount} 장 완성
            {" · "}한 장당 1~2분 정도 걸려요
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {book.status === "failed" && (
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <p className="font-medium text-red-700 dark:text-red-300">
            생성에 실패했어요.
          </p>
          {book.error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {book.error}
            </p>
          )}
          <button
            onClick={manualRetry}
            disabled={starting}
            className="mt-3 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {starting ? "다시 시도 중…" : "다시 시도"}
          </button>
        </div>
      )}

      {book.status === "completed" && (
        <a
          href={`/api/books/${book.id}/pdf`}
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-700"
        >
          ⬇️ PDF 다운로드
        </a>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
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
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${page.index + 1}쪽 삽화`}
            loading={page.index === 0 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            그림 생성 중…
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-zinc-400">
            {page.index + 1}쪽
          </p>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {regenerating ? "요청 중" : "그림 재생성"}
          </button>
        </div>
        {editing ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                본문
              </span>
              <textarea
                value={page.text}
                onChange={(event) =>
                  onChange({ text: event.currentTarget.value })
                }
                rows={4}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                이미지 프롬프트
              </span>
              <textarea
                value={page.imagePrompt ?? ""}
                onChange={(event) =>
                  onChange({ imagePrompt: event.currentTarget.value })
                }
                rows={4}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{page.text}</p>
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
