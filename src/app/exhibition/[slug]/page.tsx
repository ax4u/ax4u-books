import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { getPublishedBook, publishedBooks } from "@/lib/exhibition/catalog";
import Reader from "./Reader";
import styles from "../gallery.module.css";

const bookSerif = localFont({ src: "../../../../public/fonts/gallery/NanumMyeongjo-Regular.ttf", variable: "--font-gallery-serif", display: "swap", preload: false });

export const dynamicParams = false;
export function generateStaticParams() { return publishedBooks.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return { title: `${book.title} | 오픈 그림책 전시회`, description: book.description };
}
export default async function ExhibitionReader({ params }: { params: Promise<{ slug: string }> }) {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  return <div lang="ko" className={`${styles.gallery} ${bookSerif.variable}`} data-sketchbook-reader>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>AX4U <i>Books</i></Link>
      <nav aria-label="전자책 메뉴"><Link href="/exhibition">← 오픈 그림책 전시회</Link><Link href="/create">나의 책 만들기 ↗</Link></nav>
    </header>
    <main>
      <div className={styles.intro}><p>THE PICTURE BOOK · OPEN EXHIBITION</p><h1>{book.title}</h1><span>표지부터, 한 장씩 이야기 속으로.</span></div>
      <Reader key={book.slug} book={book} />
      <div className={styles.caption}><p>공개 작품 · 앞표지 + 본문 28쪽</p><Link href="/exhibition">전시회 목록으로 돌아가기 ↗</Link></div>
    </main>
    <footer className={styles.footer}><span>AX4U BOOKS</span><span>이야기가 머무는 작은 독서실</span></footer>
  </div>;
}
