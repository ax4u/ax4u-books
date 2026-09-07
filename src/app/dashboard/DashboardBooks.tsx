"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookSummary } from "@/lib/books/types";
import { coverImageSrc } from "@/lib/books/images";
import { statusLabel } from "@/app/books/status";
import ui from "@/app/studio.module.css";

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
    <div className={ui.library}>
      {error && <div className={ui.errorNotice} role="alert">{error}</div>}

      {recent.length > 0 && (
        <section className={ui.libraryNews} aria-labelledby="library-news-title">
          <div><p className={ui.eyebrow}>FROM YOUR BOOKS</p><h3 id="library-news-title">책장에서 온 소식</h3></div>
          <ul className={ui.newsList}>
            {recent.map((book) => (
              <li key={book.id}>
                <Link href={`/books/${book.id}`} prefetch={false} className={ui.newsLink}>{book.title || book.topic}</Link>
                <span className={ui.statusBadge} data-status={book.status}>{statusLabel(book.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className={ui.bookGrid}>
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
            <li key={book.id} className={ui.bookCard} data-status={book.status} aria-busy={busyId === book.id}>
              <Link href={`/books/${book.id}`} prefetch={false} className={ui.bookCardLink}>
                <div className={ui.coverFrame}>
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" loading="lazy" decoding="async" className={ui.bookImage} />
                  ) : (
                    <div className={ui.coverPlaceholder}>
                      <span className={ui.placeholderMark} aria-hidden="true">G.</span>
                      <span>{book.status === "failed" ? "제작이 잠시 멈췄어요" : book.status === "draft" ? "이야기의 시작을 기다려요" : book.status === "completed" ? "표지 이미지가 없어요" : "이야기를 펼치는 중이에요"}</span>
                      <small>GOBIBI STORY COLLECTION</small>
                    </div>
                  )}
                </div>
                <div className={ui.bookCardBody}>
                  <div className={ui.bookMeta}>
                    <span className={ui.statusBadge} data-status={book.status}>{statusLabel(book.status)}</span>
                    {book.pageCount > 0 && <span className={ui.fieldHint}>그림 {book.imagesReady}/{book.pageCount}장</span>}
                  </div>
                  <h3 className={ui.bookCardTitle}>{book.title || book.topic}</h3>
                  <p className={ui.bookTopic}>{book.topic}</p>
                  {book.status === "generating" && (
                    <div className={ui.progressTrack} role="progressbar" aria-label="삽화 생성 진행" aria-valuemin={0} aria-valuemax={book.pageCount} aria-valuenow={book.imagesReady}>
                      <div className={ui.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {book.status === "failed" && book.error && <p className={ui.cardError}>{book.error}</p>}
                  <span className={ui.cardOpen}>{book.status === "completed" ? "그림책 펼치기" : "제작 상태 보기"}<span aria-hidden="true">↗</span></span>
                </div>
              </Link>
              <div className={ui.bookCardActions}>
                {canResume && (
                  <button type="button" onClick={() => resume(book.id)} disabled={busyId === book.id} className={ui.primarySmall}>
                    {busyId === book.id ? "요청 중" : "생성 재개"}
                  </button>
                )}
                <button type="button" onClick={() => remove(book.id)} disabled={busyId === book.id} className={ui.dangerQuiet} aria-label={`${book.title || book.topic} 삭제`}>삭제</button>
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
