import Link from "next/link";
import Header from "@/app/components/Header";
import { getSessionUser } from "@/lib/auth";
import { isAiMock } from "@/lib/env";
import { isPolarConfigured } from "@/lib/env";

export default async function Home() {
  const user = await getSessionUser();

  const steps = [
    { n: "1", t: "주제 입력", d: "“우주를 여행하는 고양이”처럼 원하는 주제를 적어요." },
    { n: "2", t: "결제", d: "그림책 1권당 1회 결제로 간단하게 시작해요." },
    { n: "3", t: "AI 생성", d: "글과 그림을 AI가 만들어 한 장씩 채워 나가요." },
    { n: "4", t: "PDF 다운로드", d: "완성된 그림책을 PDF로 내려받아요." },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        <section className="flex flex-col items-center gap-6 py-20 text-center">
          <span className="rounded-full bg-violet-100 px-4 py-1 text-sm font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            AI 그림책 생성 서비스
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            주제만 입력하면, <br className="hidden sm:block" />
            나만의 그림책이 완성됩니다.
          </h1>
          <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            OpenAI · Gemini가 글과 그림을 만들고, 한 권의 그림책 PDF로 묶어
            드려요. 아이를 위한 동화, 선물용 그림책을 몇 분 만에.
          </p>
          <div className="flex gap-3">
            <Link
              href={user ? "/create" : "/login"}
              className="rounded-full bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-700"
            >
              그림책 만들기
            </Link>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="rounded-full border border-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              내 그림책 보기
            </Link>
          </div>

          {(isAiMock || !isPolarConfigured) && (
            <p className="mt-2 max-w-xl rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              데모 모드: 키가 설정되지 않은 서비스는 모의 데이터로 동작합니다.
              실제 연동은 SETUP.md를 참고하세요.
            </p>
          )}
        </section>

        <section className="grid gap-6 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 font-bold text-white">
                {s.n}
              </div>
              <h3 className="mb-1 font-semibold">{s.t}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
