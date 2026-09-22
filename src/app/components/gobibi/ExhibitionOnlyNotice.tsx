import Link from "next/link";
import GobibiShell from "./GobibiShell";
import PageHero from "./PageHero";
import { EXHIBITION_ONLY_MESSAGE } from "@/lib/exhibition-mode";
import ui from "@/app/studio.module.css";

export default function ExhibitionOnlyNotice() {
  return <GobibiShell theme="cream" className={ui.brand}>
    <main id="main" data-free-exhibition>
      <PageHero eyebrow="FREE ONLINE EXHIBITION" title={<>지금은, 무료로<br />이야기를 만나는 시간.</>} description={EXHIBITION_ONLY_MESSAGE} scene="studio" />
      <section className={ui.paper} aria-label="무료 전시 이용 안내">
        <p>공개 승인을 받은 그림책을 로그인 없이 읽고 상멍이와 인사해 보세요. 기존 내 책은 원래 계정으로 열람할 수 있습니다.</p>
        <div className={ui.downloadActions}>
          <Link href="/exhibition" className={ui.primaryButton}>무료 그림책 전시 보기 ↗</Link>
          <Link href="/#studio" className={ui.secondaryButton}>캐릭터 체험하기 ↗</Link>
          <Link href="/dashboard" prefetch={false} className={ui.textLink}>기존 내 책 열람 ↗</Link>
        </div>
      </section>
    </main>
  </GobibiShell>;
}
