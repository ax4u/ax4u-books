import Link from "next/link";
import { redirect } from "next/navigation";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import PageHero from "@/app/components/gobibi/PageHero";
import DashboardBooks from "./DashboardBooks";
import { getSessionUser } from "@/lib/auth";
import { listBookSummaries } from "@/lib/books/store";
import ui from "@/app/studio.module.css";

export const metadata = { title: "내 그림책 · 나의 책장 | GOBIBI" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const books = await listBookSummaries(user.id);

  return (
    <GobibiShell theme="cream" className={ui.brand}>
      <main id="main">
        <PageHero
          eyebrow="MY LITTLE LIBRARY · 나의 책장"
          title={<>당신의 이야기가<br />머무는 책장.</>}
          description="처음 떠올린 상상부터 완성된 그림책까지. 한 권씩 쌓이는 나만의 이야기를 만나 보세요. 완성된 책도 자동으로 공개 전시되지 않아요."
          scene="library"
        >
          <Link href="/exhibition" className={ui.primaryButton}>무료 전시 둘러보기 <span aria-hidden="true">↗</span></Link>
        </PageHero>
        <div className={ui.content}>
          <div className={ui.shelfHeading}>
            <h2>내 그림책 <span>{books.length}권</span></h2>
            <p>GOBIBI STORY COLLECTION</p>
          </div>
          {books.length === 0 ? (
            <section className={ui.emptyShelf} aria-labelledby="empty-shelf-title">
              <div className={ui.emptyArt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/home/gobibi/sangmung.webp" alt="책장 앞에서 첫 이야기를 기다리는 상멍이" width="787" height="1267" loading="lazy" />
              </div>
              <div className={ui.emptyCopy}>
                <p className={ui.eyebrow}>A PLACE FOR YOUR FIRST BOOK</p>
                <h3 id="empty-shelf-title">첫 번째 책 자리를<br />비워 두었어요.</h3>
                <p>기존 내 책을 보존하는 읽기 전용 책장입니다.<br />지금은 무료 전시와 캐릭터 체험을 즐겨 보세요.</p>
                <Link href="/#studio" className={ui.primaryButton}>캐릭터 체험하러 가기 <span aria-hidden="true">↗</span></Link>
                <Link href="/exhibition" className={ui.textLink}>다른 그림책에서 영감 얻기 <span aria-hidden="true">↗</span></Link>
              </div>
            </section>
          ) : (
            <DashboardBooks books={books} />
          )}
        </div>
      </main>
    </GobibiShell>
  );
}
