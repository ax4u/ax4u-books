"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/books/types";
import { statusLabel, statusClass } from "@/app/books/status";

export default function BookView({ book }: { book: Book }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const lastSig = useRef(`${book.status}:${book.pages.length}`);

  const active = book.status === "paid" || book.status === "generating";

  // Poll the lightweight status endpoint while generating; when something
  // changes, pull fresh server-rendered data (including new images).
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/books/${book.id}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const sig = `${data.status}:${data.pagesReady}`;
        if (sig !== lastSig.current) {
          lastSig.current = sig;
          router.refresh();
        }
      } catch {
        // transient — keep polling
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [active, book.id, router]);

  const startGeneration = useCallback(async () => {
    setStarting(true);
    try {
      await fetch(`/api/books/${book.id}/generate`, { method: "POST" });
      router.refresh();
    } finally {
      setStarting(false);
    }
  }, [book.id, router]);

  // If a paid book hasn't started generating yet (e.g. webhook delay), nudge it.
  // Fire-and-forget so we don't set state synchronously inside the effect.
  useEffect(() => {
    if (book.status !== "paid" || book.pages.length > 0) return;
    let cancelled = false;
    void (async () => {
      await fetch(`/api/books/${book.id}/generate`, { method: "POST" });
      if (!cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [book.status, book.pages.length, book.id, router]);

  const pages = [...book.pages].sort((a, b) => a.index - b.index);

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
            {pages.length} / {book.options.pageCount} 쪽 완성
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{
                width: `${Math.round((pages.length / book.options.pageCount) * 100)}%`,
              }}
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
            onClick={startGeneration}
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
