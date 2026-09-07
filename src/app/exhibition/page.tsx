import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
const gallerySerif = localFont({ src: "../../../public/fonts/gallery/NanumMyeongjo-Regular.ttf", variable: "--font-gallery-serif", display: "swap", preload: false });
import { publishedBooks } from "@/lib/exhibition/catalog";
import GalleryPreview from "./gallery-preview";
import styles from "./gallery.module.css";

export const metadata: Metadata = { title: "오픈 그림책 전시회 | AX4U Books", description: "종이 위에 펼쳐지는 작은 우주. 공개가 승인된 그림책을 로그인 없이 감상하세요." };

export default function ExhibitionPage() {
  return <div className={`${styles.gallery} ${gallerySerif.variable}`} lang="ko">
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>AX4U <i>Books</i></Link>
      <nav aria-label="전시회 메뉴"><Link href="/">홈</Link><a href="#collection" aria-current="page">그림책 전시회</a><Link href="/create">나의 책 만들기 ↗</Link></nav>
    </header>
    <main id="collection">
      <div className={styles.intro}><p>THE PICTURE BOOK GALLERY</p><h1>오픈 그림책 전시회</h1><span>한 장씩, 이야기 속으로.</span></div>
      {publishedBooks.map((book, i) => <article key={book.slug} id={book.slug}>
        <GalleryPreview book={book} />
        <div className={styles.caption}><p>EXHIBIT {String(i + 1).padStart(2, "0")} · 공개 작품</p><h2>{book.title}</h2><Link href={`/exhibition/${book.slug}`}>독서실에서 처음부터 읽기 <span aria-hidden="true">↗</span></Link></div>
      </article>)}
      <section className={styles.index} aria-labelledby="index-title"><div><p>CONTENTS</p><h2 id="index-title">오늘의 책장</h2></div><div>{publishedBooks.map((book, i) => <a href={`/exhibition/${book.slug}`} key={book.slug}><span>{String(i + 1).padStart(2, "0")}</span><strong>{book.title}</strong><span aria-hidden="true">↑</span></a>)}<p>공개가 승인된 원본 그림책만 전시합니다.<br />로그인 없이, 누구나 천천히 감상하세요.</p></div></section>
    </main><footer className={styles.footer}><span>AX4U BOOKS</span><span>이야기가 머무는 작은 전시실</span></footer>
  </div>;
}
