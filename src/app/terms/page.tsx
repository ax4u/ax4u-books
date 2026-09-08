import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 검토용 초안 | GOBIBI",
  description: "실제 소스에서 확인한 흐름과 미확정 운영 정책을 구분한 검토용 초안. 시행일 미정.",
  robots: { index: false, follow: false },
};

const sections = [
  {
    "title": "문서의 성격과 적용 범위",
    "paragraphs": [
      "이 이용약관은 GOBIBI(고비비)의 서비스 범위와 이용 조건을 정하기 위한 검토용 초안입니다. 확정·시행된 약관이 아니며 시행일은 미정입니다. 이 문서의 열람만으로 약관 동의나 유료 계약이 성립하지 않습니다.",
      "서비스명 GOBIBI, 운영 표기 AX4U Books, 연락처 7pmbooks@gmail.com는 사용자 제시안입니다. 계약 당사자의 법적 상호·대표자·주소·사업자 정보·소비자 문의 창구는 확인 후 기재해야 합니다."
    ]
  },
  {
    "title": "현재 코드에서 확인한 서비스",
    "paragraphs": [
      "공개 전시 그림책 열람, 캐릭터 초안 작성, 고래 비행 및 나의 고래 체험, 계정 인증, AI 그림책 제작·내 책 조회·PDF 다운로드 흐름이 구현되어 있습니다. 계정·AI·결제 기능은 외부 서비스 설정 및 이용 권한에 따라 제공 여부가 달라집니다. 소스에 기능이 있다는 사실이 실제 운영 환경에서의 제공을 보장하지는 않습니다.",
      "나의 고래는 이 브라우저에 기록을 저장하는 체험입니다. 기기 간 동기화, 실물 입양, 구매·예약을 의미하지 않습니다. 사이트 데이터 삭제나 브라우저 변경으로 기록을 잃을 수 있으며 내려받은 파일은 이용자가 관리합니다.",
      "종이책 인쇄·배송 주문은 코드에서 차단되어 있습니다. 인쇄 견적은 공급자 비용 추정치이지 소비자 최종 가격·결제 증빙이 아닙니다. 주문·배송을 제공하기 전 별도 조건과 고지가 필요합니다."
    ]
  },
  {
    "title": "가입과 계정 이용 조건 — 검토안",
    "paragraphs": [
      "이메일·비밀번호 인증과 설정에 따른 Google 인증 코드가 있습니다. 이용자는 타인의 계정을 사용하거나 인증을 우회하지 않고 자신의 로그인 정보를 안전하게 관리하는 조건을 제안합니다.",
      "가입 가능 연령, 만 14세 미만 아동의 법정대리인 동의, 미성년자의 유료 계약 동의·취소, 약관 동의 기록 보관 및 탈퇴 절차는 미확정입니다. 현재 가입 기능만으로 이러한 절차가 구현되어 있다고 설명하지 않습니다."
    ]
  },
  {
    "title": "입력 콘텐츠와 AI 결과물 — 검토안",
    "paragraphs": [
      "이용자는 입력·공유하는 글과 캐릭터 설정에 필요한 권한을 갖추고, 타인의 저작권·초상권·개인정보 등 권리를 침해하지 않는 조건을 제안합니다. 민감한 개인정보나 비밀정보를 입력하지 마세요.",
      "AI 생성물에는 부정확한 내용, 부적절한 표현, 시각적 오류 또는 다른 결과물과의 유사성이 있을 수 있습니다. 공개·인쇄·상업 이용 전 사람이 내용과 권리를 검토해야 합니다. 원하는 결과, 독점성 또는 저작권 성립을 보장하는 조항은 두지 않습니다.",
      "이용자 입력물과 생성물의 권리 귀속, 상업 이용 범위, 운영자가 서비스 제공에 필요한 이용허락의 목적·범위·기간, 외부 AI 제공자 조건은 별도 법률·계약 검토가 필요합니다. 이 초안으로 이용자의 권리를 운영자에게 일괄 양도하거나 광고·학습·공개 전시에 포괄 동의한 것으로 보지 않습니다.",
      "공개 전시 자료와 개인 제작물은 구분해야 합니다. 이용자 책을 전시·홍보에 사용하는 경우 필요한 별도 허락 절차와 철회·삭제 절차는 최종 정책으로 확정해야 합니다."
    ]
  },
  {
    "title": "가격·결제·취소·환불 — 미확정",
    "paragraphs": [
      "코드에는 Polar를 통한 그림책 단건 결제 연결과 결제 확인 후 생성 처리 흐름이 있습니다. 실제 판매 상품, 통화·세금 포함 최종 가격, 공급 시점, 결제 주체와 영수증·고객지원 책임은 구매 화면 및 계약 기준 확인이 필요합니다.",
      "청약철회·취소·환불의 요건, 신청 방법·처리 기한, 생성 실패·중복 결제·서비스 장애 시 구제, 디지털 콘텐츠 공급 개시와 철회 제한에 필요한 고지·동의는 미확정입니다. 결제 이후 환불이 일절 불가하다는 제한을 이 초안으로 정하지 않습니다.",
      "인쇄·배송을 시작할 경우 주문 성립 시점, 제작 사양·교정 승인, 배송비·지역·예정 시기, 오배송·하자·분실, 주문제작물의 취소·반품 조건을 별도로 정해야 합니다."
    ]
  },
  {
    "title": "금지행위·이용 제한·서비스 변경 — 검토안",
    "paragraphs": [
      "타인의 권리 침해, 불법 콘텐츠 입력·유포, 계정 도용, 악성 코드 전송, 보안 우회, 서비스 장애를 유발하는 남용을 금지하는 조건을 제안합니다.",
      "위반 시 조치의 기준·범위, 사전 통지, 긴급 제한 사유, 이의신청 및 복구 절차는 미확정입니다. 운영자에게 이유 없는 임의 해지 권한을 부여하는 최종 조항으로 사용하지 않습니다.",
      "점검·장애·외부 제공자 중단에 따른 서비스 변경·중단 고지, 유료 이용자 보호 및 데이터 내보내기 절차는 확정이 필요합니다. 운영자의 모든 책임을 면제하거나 이용자의 법정 권리를 제한하는 조항은 이 초안에 포함하지 않습니다."
    ]
  },
  {
    "title": "개인정보·분쟁·시행 전 확인",
    "paragraphs": [
      "개인정보 처리 흐름과 미확정 사항은 개인정보처리방침 검토용 초안에서 별도로 안내합니다. 약관 열람을 개인정보 수집·제3자 제공·국외이전에 대한 포괄 동의로 취급하지 않습니다.",
      "문의·분쟁 접수 이메일 제시안은 7pmbooks@gmail.com입니다. 정식 운영자, 소비자 피해 구제 및 분쟁 해결 절차, 적용 법률·관할은 검토 후 확정해야 합니다.",
      "최종 승인 전 사업자 고지, 가입·아동·미성년자 정책, 결제·환불, 권리·라이선스, 이용 제한·책임, 개인정보 처리와 동의 연계, 개정 고지·동의 절차 및 시행일을 확정해야 합니다. 이 페이지 작성은 이러한 운영 정책의 승인이나 법률 준수 확인을 의미하지 않습니다."
    ]
  }
] as const;
const sources = [
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
        <Link href="/privacy">개인정보처리방침 초안</Link>
        <Link href="/terms" aria-current="page">이용약관 초안</Link>
      </nav>
      <header className="mb-10">
        <p className="mb-4 text-sm font-bold tracking-widest">GOBIBI / AX4U Books</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">이용약관</h1>
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
