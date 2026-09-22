import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 검토용 초안 | GOBIBI",
  description: "실제 소스에서 확인한 흐름과 미확정 운영 정책을 구분한 검토용 초안. 시행일 미정.",
  robots: { index: false, follow: false },
};

const sections = [
  {
    "title": "현재 무료 전시의 처리 범위",
    "paragraphs": [
      "현재 운영은 비상업 무료 전시와 브라우저 안 캐릭터 체험입니다. 신규 결제·AI 제작·재생성·인쇄 견적·주문 및 결제 웹훅·생성 작업 처리는 서버에서 차단되어 있습니다. 아래 관련 설명은 보존된 코드의 흐름이며 현재의 신규 수집·전송을 의미하지 않습니다.",
      "기존 계정 인증과 본인 책 열람, 기존 방문 통계는 유지됩니다. 기존 개인정보를 추가 공개하지 않으며, 편집·삭제 중지나 전시 전환이 기존 데이터·외부 로그의 삭제를 뜻하지는 않습니다. 소감 파일은 재방문 의향과 자유 의견을 내려받으며 유료 전환·구매 의향을 새로 묻지 않습니다."
    ]
  },
  {
    "title": "이 문서의 상태와 운영자 제시안",
    "paragraphs": [
      "이 문서는 현재 작업 소스에서 확인한 처리 흐름과 운영자가 결정해야 할 사항을 분리한 검토용 초안입니다. 실제 배포 환경, 계약, 관리 콘솔, 법률 검토를 확인한 최종 개인정보처리방침이 아닙니다. 시행일은 미정이며, 검토·승인 전 확정 고지로 사용하지 않습니다.",
      "서비스명 GOBIBI(고비비), 운영 표기 AX4U Books, 연락처 7pmbooks@gmail.com는 사용자 제시안입니다. 개인정보처리자의 법적 명칭·주소 및 개인정보 보호책임자·담당 부서는 확인이 필요합니다."
    ]
  },
  {
    "title": "소스에서 확인한 계정·그림책 처리",
    "paragraphs": [
      "이메일 회원가입·로그인 시 이메일과 비밀번호를 Supabase Auth에 전달합니다. 앱의 세션 사용자 정보는 사용자 ID와 이메일입니다. Google 로그인 코드도 있으나 실제 제공 여부는 Supabase의 Google 인증 설정에 따라 달라집니다. Google에서 받는 전체 프로필 항목·동의 화면·필수/선택 범위는 별도 확인 대상입니다.",
      "그림책 제작 시 주제, 주인공 이름·특징(입력한 경우), 그림 스타일, 페이지 수, 대상 연령대, 언어를 받습니다. 주인공 설정은 주제에 합쳐 저장됩니다. 대상 연령대는 책의 독자 설정이며 가입자의 실제 나이를 확인하는 값이 아닙니다.",
      "책에는 사용자 ID, 주제·옵션, 생성된 제목·본문·이미지 관련 정보, PDF 경로, 처리 상태·오류, 결제 연결 ID, 생성·수정 시각을 저장하는 코드가 있습니다. Supabase 설정 시 데이터베이스·Storage를 사용하며, 로컬 데모에는 메모리 저장 분기가 있습니다. 생성 작업에는 작업 상태·시도 횟수·오류 등의 기록도 있습니다.",
      "처리 목적은 계정 인증과 로그인 유지, 내 책 조회, AI 이야기·삽화 생성, 결과 저장·다운로드, 결제 연결 및 작업 복구입니다. 항목별 법적 처리 근거, 필수/선택 구분과 미제공 시 제한은 운영 정책으로 확정해야 합니다."
    ]
  },
  {
    "title": "외부 서비스와 전송 흐름",
    "paragraphs": [
      "AI 제공자는 설정에 따라 OpenAI 또는 Google Gemini(API 또는 Vertex AI)로 선택됩니다. 이야기 생성에는 주제·제작 옵션이, 이미지 생성에는 프롬프트와 참조 이미지가 있는 경우 해당 이미지가 전달되는 코드입니다. 실제 사용 제공자·계약·학습 이용 여부·제공자 측 보관 조건은 소스만으로 확정할 수 없습니다. 실명, 연락처, 건강정보 등 본인·타인의 개인정보를 창작 입력에 넣지 않는 것을 권합니다.",
      "Polar 결제 연결 코드에는 이메일, 사용자 ID, 책 ID를 보내고 checkout ID를 저장하는 흐름이 있습니다. 결제 페이지에서 직접 수집하는 결제정보 항목과 운영자에게 전달되는 정보의 전체 범위는 별도 확인이 필요합니다. 결제 활성화 여부는 배포 설정에 따라 달라집니다.",
      "Sweetbook 인쇄 연동 코드는 있으나 주문 API는 요청 본문을 읽기 전에 비활성 오류를 반환합니다. 따라서 이 코드에서 배송 수령인 정보를 수집하는 주문 흐름은 열려 있지 않습니다. 인쇄 견적은 공급자 추정 비용이며 소비자 결제 가격이 아닙니다.",
      "Supabase, AI 제공자, Polar, Vercel Analytics 및 향후 인쇄사의 처리위탁·제3자 제공 여부와 각각의 법적 역할은 계약·실제 흐름 확인 후 구분해야 합니다. 국외이전 여부, 받는 자·연락처, 국가, 항목, 목적, 시기·방법, 보유·이용기간, 법적 근거, 거부 방법·효과는 미확정입니다. 특정 국가나 기간을 임의로 고지하지 않습니다."
    ]
  },
  {
    "title": "쿠키·브라우저 저장소·접속 분석",
    "paragraphs": [
      "Supabase SSR 쿠키로 인증 상태를 유지·갱신하는 코드가 있습니다. 브라우저에서 쿠키를 차단·삭제하면 로그인 관련 기능이 제한될 수 있습니다. 실제 쿠키 명칭·만료 설정과 운영 로그의 수집 항목·기간은 배포 환경 확인이 필요합니다.",
      "주인공 초안은 localStorage의 ax4u.characterDraft.v1에 이름·특징을 저장하며 제작 폼에서 불러옵니다. 나의 고래는 gobibi.first-whale.v1에 고래 이름·한 줄, 생성 시각, 기분, 이동·카드·방문 기록 등을 저장합니다. 해당 고래 기능에서 이 기록을 서버 계정으로 동기화하는 코드는 확인하지 않았습니다.",
      "고래 카드 PNG에는 이름과 한 줄이 포함됩니다. 소감 JSON은 재방문 의향, 자유 의견, 일부 이용 횟수를 파일로 내려받으며 자동 제출하지 않습니다. 자유 의견에 직접 적은 개인정보는 파일에 포함될 수 있습니다. 내려받은 파일을 외부에 공유할지는 이용자가 결정합니다.",
      "브라우저 사이트 데이터 삭제로 로컬 초안을 지울 수 있으며, 나의 고래에는 기록 지우기 기능이 있습니다. 이 작업은 이미 내려받은 파일을 삭제하지 않습니다. sessionStorage의 gobibi.flight.enter는 비행 화면 진입에 사용됩니다. 로컬 저장 코드에 자동 보관 만료 정책이 명시되어 있지 않습니다.",
      "루트 레이아웃에 Vercel Analytics가 포함되어 있어 이 문서 화면도 그 레이아웃을 사용합니다. 실제 분석 활성화 여부, 전송 항목·식별 방식·보관기간·거부 방법은 별도 검증 대상입니다. 서비스 전체가 무추적이거나 개인정보를 전혀 수집하지 않는다고 단정하지 않습니다."
    ]
  },
  {
    "title": "보유기간·파기·안전조치",
    "paragraphs": [
      "서버 개인정보, 결제 관련 기록, 생성물, 로그, 백업의 보유기간과 기간 산정 기준은 미확정입니다. 법령상 보존 의무가 적용되는 기록·근거·기간을 검토한 뒤 항목별로 정해야 합니다. 탈퇴 즉시 모든 데이터가 완전히 삭제된다고 약속하지 않습니다.",
      "책 삭제 API는 소유자를 확인하고 이미지·PDF 자산 삭제를 시도한 후 책 레코드를 삭제합니다. 자산 정리에 실패해도 다음 삭제 단계로 진행하는 코드가 있어 잔존 자산·백업까지 완전히 파기된다고 보장할 수 없습니다. 계정 탈퇴, 잔존 자산 정리, 파기 시점·방법과 처리 기록 운영은 별도 확인 대상입니다.",
      "인증·책 소유자 확인·비공개 Storage를 전제로 한 접근 코드가 있습니다. 실제 권한 설정, 접근기록 관리, 암호화, 내부 관리계획 등 안전조치 전체의 운영 적정성과 법률 준수는 검증하지 않았습니다."
    ]
  },
  {
    "title": "권리 행사·아동 보호·문의",
    "paragraphs": [
      "열람, 정정·삭제, 처리정지, 동의 철회 및 탈퇴 요청 창구의 제시안은 아래 이메일입니다. 정식 책임자, 본인·대리인 확인 절차, 처리 기한, 제한 사유 및 이의제기·피해 구제 안내는 확정이 필요합니다. 문의 시 비밀번호나 신분증 원본을 보내지 마세요.",
      "만 14세 미만 아동의 이용 허용 여부, 법정대리인 동의·확인 방법과 아동 개인정보 보호 절차는 미확정입니다. 현재 이메일 가입 코드의 존재만으로 아동 동의 절차가 갖춰졌다고 볼 수 없습니다.",
      "최종 게시 전 운영자 식별정보, 처리 목적·항목·근거, 수집 방법, 보유·파기, 수탁자·제3자 제공·국외이전, 자동 수집·거부, 안전조치, 권리 행사·책임자·구제기관, 아동 정책, 시행일과 변경 고지 절차를 실제 운영 기준으로 확정해야 합니다."
    ]
  }
] as const;
const sources = [
  "src/lib/exhibition-mode.ts",
  "src/app/auth/actions.ts",
  "src/lib/auth.ts",
  "src/lib/google-auth.ts",
  "src/lib/supabase/server.ts",
  "src/proxy.ts",
  "src/app/books/actions.ts",
  "src/lib/books/types.ts",
  "src/lib/books/store.ts",
  "src/lib/books/assets.ts",
  "src/app/api/books/[id]/route.ts",
  "src/lib/ai/index.ts",
  "src/lib/ai/openai.ts",
  "src/lib/ai/gemini.ts",
  "src/lib/polar/checkout.ts",
  "src/lib/printing/handlers.ts",
  "src/app/layout.tsx",
  "src/app/components/home/CharacterDraft.tsx",
  "src/app/create/CreateForm.tsx",
  "src/app/my-whale/MyWhaleExperience.tsx",
  "src/app/my-whale/whale-state.ts",
  "src/app/components/gobibi/FlightLink.tsx",
  "src/app/whale-flight/FlightExperience.tsx"
] as const;

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 text-[#12375a] sm:px-10 sm:py-16">
      <nav aria-label="문서 탐색" className="mb-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold underline underline-offset-4">
        <Link href="/">GOBIBI 홈</Link>
        <Link href="/privacy" aria-current="page">개인정보처리방침 초안</Link>
        <Link href="/terms">이용약관 초안</Link>
      </nav>
      <header className="mb-10">
        <p className="mb-4 text-sm font-bold tracking-widest">GOBIBI / AX4U Books</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">개인정보처리방침</h1>
        <aside aria-label="초안 상태 안내" className="mt-6 rounded-2xl border-2 border-[#12375a] bg-[#ffe78c] p-5 leading-7">
          <p className="font-bold">검토용 초안 · 시행일 미정 · 승인 전</p>
          <p>소스에서 확인한 구현과 미확정 정책을 구분했습니다. 실제 운영·계약 및 법률 검토 후 확정해야 하며, 현재 효력이 있는 확정 고지로 사용하지 않습니다.</p>
        </aside>
      </header>
      <nav aria-label="문서 목차" className="mb-10 rounded-2xl bg-white/70 p-6">
        <h2 className="mb-3 font-bold">목차</h2>
        <ol className="list-decimal space-y-2 pl-5">
          {sections.map((section, index) => <li key={section.title}><a className="underline underline-offset-4" href={`#section-${index + 1}`}>{section.title}</a></li>)}
        </ol>
      </nav>
      <div className="space-y-10">
        {sections.map((section, index) => (
          <section key={section.title} id={`section-${index + 1}`} aria-labelledby={`heading-${index + 1}`} className="scroll-mt-6 border-t border-[#12375a]/20 pt-7">
            <h2 id={`heading-${index + 1}`} className="mb-4 text-xl font-bold leading-8">{index + 1}. {section.title}</h2>
            <div className="space-y-4 text-base leading-8 [overflow-wrap:anywhere]">
              {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
      <details className="mt-12 rounded-2xl border border-[#12375a]/30 bg-white/70 p-5">
        <summary className="cursor-pointer font-bold">검토 근거: 확인한 소스 파일</summary>
        <p className="mt-4 text-sm leading-7">현재 작업 소스 기준입니다. 배포 상태·외부 서비스 계약·관리 콘솔은 이 확인 범위에 포함하지 않습니다. 아래 경로는 검토용 참조이며 공개 다운로드 링크가 아닙니다.</p>
        <ul className="mt-3 space-y-2 text-xs leading-6 [overflow-wrap:anywhere]">{sources.map(source => <li key={source}><code>{source}</code></li>)}</ul>
      </details>
      <footer className="mt-10 border-t border-[#12375a]/20 pt-6 text-sm leading-7">
        <p>문의 이메일 제시안: <a className="font-bold underline underline-offset-4" href="mailto:7pmbooks@gmail.com">7pmbooks@gmail.com</a></p>
        <p>정식 운영자 정보와 정책을 확인한 뒤 최종 승인·게시합니다.</p>
      </footer>
    </main>
  );
}
