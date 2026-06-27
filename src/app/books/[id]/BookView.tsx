"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/books/types";
import { statusLabel, statusClass } from "@/app/books/status";

// If a generating book hasn't been updated in this long, the serverless run
// likely timed out — nudge it to resume (generation is resumable).
const STALL_MS = 150_000;

export default function BookView({ book }: { book: Book }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const imagesReady = book.pages.filter((p) => p.image).length;
  const lastSig = useRef(`${book.status}:${imagesReady}`);
  const lastTrigger = useRef(0);

  const active = book.status === "paid" || book.status === "generating";

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
    try {
      lastTrigger.current = 0; // allow immediate retry
      await fetch(`/api/books/${book.id}/generate`, { method: "POST" });
      router.refresh();
    } finally {
      setStarting(false);
    }
  }, [book.id, router]);

  const pages = [...book.pages].sort((a, b) => a.index - b.index);
  const pct = Math.round((imagesReady / book.options.pageCount) * 100);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{book.title || book.topic}</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(book.status)}`}
        >
          {statusLabel(book.status)}
        </span>
      </div>
      <p className="mb-8 text-zinc-500">주제: {book.topic}</p>

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
        {pages.map((page) => (
          <div
            key={page.index}
            className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
              {page.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.image}
                  alt={`${page.index + 1}쪽 삽화`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  그림 생성 중…
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="mb-1 text-xs font-medium text-zinc-400">
                {page.index + 1}쪽
              </p>
              <p className="text-sm leading-relaxed">{page.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
