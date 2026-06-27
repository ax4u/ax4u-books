import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/app/components/Header";
import { getSessionUser } from "@/lib/auth";
import { listBooks } from "@/lib/books/store";
import { statusLabel, statusClass } from "@/app/books/status";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const books = await listBooks(user.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">내 그림책</h1>
          <Link
            href="/create"
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
              className="font-medium text-violet-600 hover:underline"
            >
              첫 그림책 만들러 가기 →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => {
              const cover = book.pages.find((p) => p.image)?.image;
              return (
                <li key={book.id}>
                  <Link
                    href={`/books/${book.id}`}
                    className="block overflow-hidden rounded-2xl border border-zinc-200 transition hover:shadow-md dark:border-zinc-800"
                  >
                    <div className="aspect-square bg-zinc-100 dark:bg-zinc-900">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl">
                          📖
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(book.status)}`}
                        >
                          {statusLabel(book.status)}
                        </span>
                      </div>
                      <p className="line-clamp-1 font-semibold">
                        {book.title || book.topic}
                      </p>
                      <p className="line-clamp-1 text-sm text-zinc-500">
                        {book.topic}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
