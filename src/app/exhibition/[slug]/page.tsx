import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import GobibiArt from "@/app/components/gobibi/GobibiArt";
import { getPublishedBook, publishedBooks } from "@/lib/exhibition/catalog";
import { pageSocialMetadata, SITE_ORIGIN } from "@/lib/site-metadata";
import Reader from "./ResponsiveReader";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
import styles from "./reader.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return publishedBooks.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();
  const social = pageSocialMetadata(`/exhibition/${book.slug}`);
  const title = `${book.title} | GOBIBI 고비비 독서실`;
  const image = { url: new URL(book.cover.src, SITE_ORIGIN).href, width: book.cover.width, height: book.cover.height, type: "image/webp", alt: `${book.title} 앞표지` };
  return {
    ...social, title, description: book.description,
    openGraph: { ...social.openGraph, title, description: book.description, images: [image] },
    twitter: { ...social.twitter, title, description: book.description, images: [{ url: image.url, alt: image.alt }] },
  };
}

export default async function ExhibitionReader({ params }: { params: Promise<{ slug: string }> }) {
  const book = getPublishedBook((await params).slug);
  if (!book) notFound();

  return (
    <GobibiShell theme="cream" className={styles.readingRoom}>
      <main id="main" data-sketchbook-reader>
        <div className={styles.roomIntro}>
          <nav className={styles.breadcrumb} aria-label="전자책 메뉴">
            <Link href="/exhibition">← 오픈 그림책 전시회</Link>
            <span>GOBIBI READING ROOM</span>
            <Link href="/#studio">무료 캐릭터 체험 <span aria-hidden="true">↗</span></Link>
          </nav>
          <div className={styles.roomWelcome}>
            <div className={styles.titleCopy}>
              <p className={styles.eyebrow}>이야기가 머무는 작은 독서실</p>
              <h1>{book.title}</h1>
              <p>{book.author}</p>
              <p className={styles.roomDescription}>{book.description}</p>
              {book.reviewNotice && <p>{book.reviewNotice}</p>}
            </div>
            <div className={styles.roomScene}>
              <GobibiArt scene="library" quiet className={styles.libraryArt} />
              <span>잠시, 이야기 속에 머물러요.</span>
            </div>
          </div>
          <div className={styles.deskLabel}><span>OPEN A BOOK, FIND A WORLD.</span><a href="#reader-help">읽기 도구 안내 <span aria-hidden="true">↓</span></a></div>
        </div>

        <Reader key={book.slug} book={book} />

        <div className={styles.caption}>
          <p>공개 작품 · {book.author} · 표지 포함 감상 이미지 {book.pages.length}장</p>
          {book.fullCover && <a href={book.fullCover.src} target="_blank" rel="noopener noreferrer">전체 표지 보기 (뒷표지 · 책등 · 앞표지, 새 창)</a>}
          {book.readingPdf && <a href={book.readingPdf} target="_blank" rel="noopener noreferrer">읽기용 PDF 열기 (새 창)</a>}
          <span>글과 그림은 원본 그대로, 이야기는 나만의 속도로.</span>
        </div>
        <section className={styles.afterReading} aria-labelledby="after-reading-title">
          <div>
            <p className={styles.eyebrow}>TAKE A LITTLE STORY WITH YOU</p>
            <h2 id="after-reading-title">책을 덮어도,<br />상상은 계속돼요.</h2>
            <p>마음에 남은 장면을 잠시 떠올려 보세요.<br />이번에는 당신의 이야기를 시작해도 좋아요.</p>
          </div>
          <div className={styles.readingLinks}>
            <Link href="/exhibition" className={styles.backToBooks}>전시회 목록으로 돌아가기 <span aria-hidden="true">↗</span></Link>
            <Link href="/#studio" className={styles.createLink}>상멍이와 무료 캐릭터 체험 <span aria-hidden="true">↗</span></Link>
            <span>고비비에서, 다음 이야기로 만나요.</span>
          </div>
        </section>
      </main>
    </GobibiShell>
  );
}
