import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOutAction } from "@/app/auth/actions";

export default async function Header() {
  const user = await getSessionUser();

  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          📚 AX4U Books
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                내 그림책
              </Link>
              <Link
                href="/create"
                className="rounded-full bg-violet-600 px-4 py-1.5 font-medium text-white hover:bg-violet-700"
              >
                새로 만들기
              </Link>
              <span className="hidden text-zinc-500 sm:inline">
                {user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-violet-600 px-4 py-1.5 font-medium text-white hover:bg-violet-700"
            >
              시작하기
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
