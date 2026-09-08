import Link from "next/link";
import { redirect } from "next/navigation";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import GobibiArt from "@/app/components/gobibi/GobibiArt";
import LoginForm from "./LoginForm";
import { getSessionUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import ui from "@/app/studio.module.css";

export const metadata = { title: "로그인 · 구름 도착 부두 | GOBIBI" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <GobibiShell theme="sky" className={ui.brand}>
      <main id="main" className={ui.arrival}>
        <section className={ui.arrivalWorld} aria-labelledby="arrival-title">
          <p className={ui.eyebrow}>GOBIBI ARRIVAL · 고비비 입구</p>
          <h1 id="arrival-title" className={ui.arrivalTitle}>
            어서 와요,<br />이야기를 품은 당신.
          </h1>
          <p className={ui.arrivalLead}>
            하늘을 헤엄치는 고래와 상멍이가 사는 곳.<br />
            당신의 작은 상상도 이곳에서 한 권의 책이 됩니다.
          </p>
          <GobibiArt scene="arrival" className={ui.arrivalArt} />
          <div className={ui.arrivalFootnote}>
            <span>작은 상상과 오래 함께하는 세계</span>
            <Link href="/exhibition" className={ui.textLink}>먼저 그림책 둘러보기 <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className={ui.passport} aria-label="고비비 로그인과 회원가입">
          <div className={ui.passportTop}>
            <span className={ui.eyebrow}>YOUR STORY PASSPORT</span>
            <span className={ui.passportStamp} aria-hidden="true">GOBIBI<br />어서 와요</span>
          </div>
          <p className={ui.passportBrand}>Hello, storyteller.</p>
          <p className={ui.passportIntro}>나만의 책장으로 들어가는 작은 초대장.</p>
          {error && <p className={ui.errorNotice} role="alert">{error}</p>}
          <LoginForm mockMode={!isSupabaseConfigured} />
          <p className={ui.passportBottom}>GOBIBI × SANG#MUNG <span aria-hidden="true">✳</span> 상상의 첫 장에서</p>
        </section>
      </main>
    </GobibiShell>
  );
}
