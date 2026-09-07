import Link from "next/link";
import { redirect } from "next/navigation";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import PageHero from "@/app/components/gobibi/PageHero";
import CreateForm from "./CreateForm";
import { getSessionUser } from "@/lib/auth";
import { isPolarConfigured } from "@/lib/env";
import ui from "@/app/studio.module.css";

export const metadata = { title: "이야기 작업실 | GOBIBI" };

export default async function CreatePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <GobibiShell theme="cream" className={ui.brand}>
      <main id="main">
        <PageHero
          eyebrow="THE STORY STUDIO · 상멍이의 제작실"
          title={<>작은 상상,<br />첫 장을 펼쳐 볼까요?</>}
          description="주인공과 이야기를 들려주세요. 주제와 옵션을 정하면 결제 후 AI가 글과 그림을 생성합니다."
          scene="studio"
        />
        <div className={ui.studioLayout}>
          <section className={ui.paper} aria-label="새 그림책 제작 설정">
            <div className={ui.paperHeading}>
              <span className={ui.eyebrow}>A LITTLE IDEA, A NEW BOOK</span>
              <span className={ui.smallTag}>새 그림책 만들기</span>
            </div>
            <CreateForm mockPayment={!isPolarConfigured} />
          </section>
          <aside className={ui.studioAside}>
            <div className={ui.noteCard}>
              <p className={ui.eyebrow}>상멍이의 작은 메모</p>
              <h2>멋진 문장보다,<br />하고 싶은 이야기.</h2>
              <p>누가, 어디에서, 무엇을 만나게 될까요? 떠오르는 장면을 한 줄씩 적어 보세요.</p>
              <ol className={ui.journeyList}>
                <li><span>01</span><div><strong>이야기 정하기</strong><p>주인공, 주제와 그림 스타일을 골라요.</p></div></li>
                <li><span>02</span><div><strong>결제 후 제작</strong><p>AI가 글과 그림을 생성해요.</p></div></li>
                <li><span>03</span><div><strong>내 책장에서 확인</strong><p>완성된 내용을 읽고 직접 검토해요.</p></div></li>
              </ol>
            </div>
            <div className={ui.asideNote}>
              <h2>시작 전에 알아두세요</h2>
              <p>AI가 만든 글과 그림에는 수정이 필요한 부분이 있을 수 있어요. 캐릭터의 모습과 이야기 내용을 완성 후 확인해 주세요.</p>
              <p>종이책 인쇄·배송 주문은 아직 제공하지 않아요.</p>
              <Link href="/dashboard" prefetch={false} className={ui.textLink}>내 책장으로 <span aria-hidden="true">↗</span></Link>
            </div>
          </aside>
        </div>
      </main>
    </GobibiShell>
  );
}
