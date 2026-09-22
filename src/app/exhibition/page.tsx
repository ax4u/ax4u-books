import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import PageHero from "@/app/components/gobibi/PageHero";
import GobibiArt from "@/app/components/gobibi/GobibiArt";
import { publishedBooks } from "@/lib/exhibition/catalog";
import { pageSocialMetadata } from "@/lib/site-metadata";
import styles from "./gallery.module.css";

const social = pageSocialMetadata("/exhibition");
const title = "그림책 전시회 | GOBIBI 고비비";
const description = "고비비의 작은 독서실. 공개가 승인된 그림책을 로그인 없이, 표지부터 마지막 장까지 천천히 펼쳐 보세요.";
const image = {
  url: "https://gobibi.art/social/exhibition-library-v1.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "고비비 그림책 전시회 — 하늘을 나는 고래와 구름 위 책으로 가득한 작은 도서관",
};

export const metadata: Metadata = {
  ...social,
  title,
  description,
  openGraph: { ...social.openGraph, title, description, images: [image] },
  twitter: { ...social.twitter, title, description, images: [{ url: image.url, alt: image.alt }] },
};

export default function ExhibitionPage() {
  return (
    <GobibiShell theme="cream" className={styles.gallery}>
      <main id="main">
        <PageHero
          eyebrow="GOBIBI LIBRARY · 그림책 전시회"
          title={<>책 한 권을 펼치면,<br />또 다른 세계.</>}
          description={<>하늘을 헤엄치는 고래들 곁에 작은 독서실을 열었어요.<br />상멍이와 함께, 한 장씩 이야기 속으로 들어가 볼까요?</>}
          scene="library"
        >
          <div className={styles.heroActions}>
            <a href="#books" className={styles.primaryLink}>그림책 만나러 가기 <span aria-hidden="true">↓</span></a>
            <a href="#reading-guide" className={styles.textLink}>천천히 읽는 법 <span aria-hidden="true">↗</span></a>
          </div>
          <p className={styles.heroNote}>로그인 없이 감상 · 공개가 승인된 그림책 {publishedBooks.length}권</p>
        </PageHero>

        <section id="books" className={styles.collection} aria-labelledby="books-title">
          <div className={styles.sectionMeta}><span>01 — OPEN BOOKS</span><span>작은 상상이 한 권의 책으로</span></div>
          <div className={styles.sectionHeading}>
            <h2 id="books-title">오픈 그림책 전시회</h2>
            <p>{publishedBooks.length === 0 ? <>현재 공개 중인 그림책이 없습니다.</> : <>지금 만날 수 있는 그림책이에요.<br />마음이 가는 표지를 눌러 보세요.</>}</p>
          </div>
          <div className={styles.bookGrid}>
            {publishedBooks.map(book => (
              <article key={book.slug} className={styles.bookCard}>
                <Link href={`/exhibition/${book.slug}`} className={styles.bookLink} aria-label={`${book.title} 그림책 펼치기`}>
                  <div className={styles.coverPanel}>
                    <div className={styles.coverTopline}><span>GOBIBI BOOKSHELF</span><span aria-hidden="true">✳</span></div>
                    <Image
                      src={book.cover.src}
                      alt={`${book.title} 앞표지`}
                      width={book.cover.width}
                      height={book.cover.height}
                      sizes="(max-width: 700px) 82vw, (max-width: 1100px) 42vw, 490px"
                      unoptimized
                      className={styles.coverImage}
                    />
                    <span className={styles.coverCaption}>한 권의 책, 하나의 새로운 세계.</span>
                  </div>
                  <div className={styles.bookCopy}>
                    <p className={styles.eyebrow}>SELECTED PICTURE BOOK</p>
                    <h3>{book.title}</h3>
                    <p className={styles.bookDescription}>{book.description}</p>
                    <dl className={styles.bookFacts}>
                      <div><dt>지은이</dt><dd>{book.author}</dd></div>
                      <div><dt>책 속으로</dt><dd>표지 포함 감상 이미지 {book.pages.length}장</dd></div>
                      <div><dt>감상 방법</dt><dd>로그인 없이, 자유롭게</dd></div>
                    </dl>
                    <span className={styles.openBook}>그림책 펼치기 <span aria-hidden="true">↗</span></span>
                    <small>표지부터 시작하는 온라인 그림책 전시</small>
                  </div>
                </Link>
              </article>
            ))}
          </div>
          <p className={styles.collectionNote}>이 책장에는 공개가 승인된 작품만 놓아두어요. 한 권씩, 오래 바라봐 주세요.</p>
        </section>

        <section id="reading-guide" className={styles.readingGuide} aria-labelledby="reading-guide-title">
          <div className={styles.sectionMeta}><span>02 — SLOW READING</span><span>서두르지 않아도 괜찮아요</span></div>
          <div className={styles.sectionHeading}>
            <h2 id="reading-guide-title">그림책과 친해지는 법.</h2>
            <p>작은 그림 하나, 짧은 문장 하나.<br />나만의 속도로 발견해 보세요.</p>
          </div>
          <ol className={styles.guideSteps}>
            <li><span className={styles.stepNumber} aria-hidden="true">01</span><h3>표지에서 인사하기</h3><p>책을 누르면 앞표지부터 만나요. 어떤 이야기가 기다릴지, 잠시 상상해 보세요.</p></li>
            <li><span className={styles.stepNumber} aria-hidden="true">02</span><h3>한 장씩, 천천히</h3><p>이전·다음 버튼이나 키보드 방향키로 넘겨요. 휴대폰에서는 좌우로 밀어도 좋아요.</p></li>
            <li><span className={styles.stepNumber} aria-hidden="true">03</span><h3>조금 더 가까이 보기</h3><p>확대 버튼으로 글과 그림을 키워 보세요. 마우스가 있다면 돋보기로 작은 장면도 살펴봐요.</p></li>
          </ol>
          <div className={styles.sangmungNote}>
            <Image src="/home/gobibi/sangmung.webp" alt="종이 선원 모자를 쓴 고비비의 친구, 상멍이" width={787} height={1267} sizes="110px" className={styles.sangmung} />
            <div><p className={styles.eyebrow}>A LITTLE NOTE FROM SANG#MUNG</p><p>마음에 드는 장면에서는,<br /><strong>조금 더 머물러도 좋아.</strong></p><span>이야기 옆에서 함께하는 친구, 상멍이</span></div>
          </div>
        </section>

        <section className={styles.studioInvitation} aria-labelledby="studio-invitation-title">
          <div className={styles.studioCopy}>
            <p className={styles.eyebrow}>03 — YOUR NEXT STORY</p>
            <h2 id="studio-invitation-title">다음 이야기는,<br />당신에게서.</h2>
            <p>책을 덮고 떠오른 작은 생각이 있나요?<br />상멍이와 함께, 나만의 캐릭터와 첫 이야기를 시작해 보세요.</p>
            <Link href="/#studio" className={styles.primaryLink}>무료 캐릭터 체험하기 <span aria-hidden="true">↗</span></Link>
            <Link href="/#sangmung" className={styles.textLink}>상멍이와 먼저 인사하기 <span aria-hidden="true">↗</span></Link>
          </div>
          <div className={styles.studioScene}><GobibiArt scene="studio" quiet className={styles.studioArt} /><span>FROM A LITTLE IDEA TO A WHOLE NEW WORLD</span></div>
        </section>
      </main>
    </GobibiShell>
  );
}
