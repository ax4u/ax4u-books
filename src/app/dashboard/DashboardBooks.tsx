"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookSummary } from "@/lib/books/types";
import { coverImageSrc } from "@/lib/books/images";
import { statusClass, statusLabel } from "@/app/books/status";

export default function DashboardBooks({ books }: { books: BookSummary[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recent = books
    .filter((book) => book.status === "completed" || book.status === "failed")
    .slice(0, 3);

  async function resume(bookId: string) {
    setBusyId(bookId);
    setError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "생성 재개 요청에 실패했어요."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(bookId: string) {
    if (!window.confirm("이 그림책을 삭제할까요? 생성된 이미지와 PDF도 삭제됩니다.")) {
      return;
    }

    setBusyId(bookId);
    setError(null);
    try {
      const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "그림책 삭제에 실패했어요."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {recent.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold text-zinc-500">최근 알림</h2>
          <ul className="space-y-2 text-sm">
            {recent.map((book) => (
              <li key={book.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/books/${book.id}`}
                  prefetch={false}
                  className="min-w-0 hover:underline"
                >
                  <span className="line-clamp-1">
                    {book.title || book.topic}
                  </span>
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(book.status)}`}
                >
                  {statusLabel(book.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => {
          const cover =
            book.coverImage ??
            coverImageSrc(
              book.id,
              book.coverImagePath,
              book.coverImageAvailable,
            );
          const pct =
            book.pageCount > 0
              ? Math.round((book.imagesReady / book.pageCount) * 100)
              : 0;
          const canResume =
            book.status === "paid" ||
            book.status === "failed" ||
            (book.status === "generating" && book.imagesReady < book.pageCount);

          return (
            <li
              key={book.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <Link
                href={`/books/${book.id}`}
                prefetch={false}
                className="block"
              >
                <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">
                      📖
                    </div>
                  )}
                </div>
                <div className="p-4 pb-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(book.status)}`}
                    >
                      {statusLabel(book.status)}
                    </span>
                    {book.pageCount > 0 && (
                      <span className="text-xs text-zinc-500">
                        {book.imagesReady}/{book.pageCount}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 font-semibold">
                    {book.title || book.topic}
                  </p>
                  <p className="line-clamp-1 text-sm text-zinc-500">
                    {book.topic}
                  </p>
                  {book.status === "generating" && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {book.status === "failed" && book.error && (
                    <p className="mt-2 line-clamp-2 text-xs text-red-600 dark:text-red-400">
                      {book.error}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
                {canResume && (
                  <button
                    type="button"
                    onClick={() => resume(book.id)}
                    disabled={busyId === book.id}
                    className="flex-1 rounded-full bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {busyId === book.id ? "요청 중" : "생성 재개"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(book.id)}
                  disabled={busyId === book.id}
                  className="flex-1 rounded-full border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  삭제
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) {
    return `${fallback} ${err.message}`;
  }
  return fallback;
}
