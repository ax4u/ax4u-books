import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/app/components/Header";
import DashboardBooks from "./DashboardBooks";
import { getSessionUser } from "@/lib/auth";
import { listBookSummaries } from "@/lib/books/store";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const books = await listBookSummaries(user.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">내 그림책</h1>
          <Link
            href="/create"
            prefetch={false}
            className="rounded-full bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700"
          >
            새 그림책 만들기
          </Link>
        </div>

        {books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-16 text-center dark:border-zinc-700">
            <p className="mb-4 text-zinc-500">아직 만든 그림책이 없어요.</p>
            <Link
              href="/create"
              prefetch={false}
              className="font-medium text-violet-600 hover:underline"
            >
              첫 그림책 만들러 가기 →
            </Link>
          </div>
        ) : (
          <DashboardBooks books={books} />
        )}
      </main>
    </div>
  );
}
