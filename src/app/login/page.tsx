import { redirect } from "next/navigation";
import Header from "@/app/components/Header";
import LoginForm from "./LoginForm";
import { getSessionUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16">
        <h1 className="mb-2 text-2xl font-bold">시작하기</h1>
        <p className="mb-8 text-sm text-zinc-500">
          로그인하고 나만의 AI 그림책을 만들어 보세요.
        </p>
        {error && (
          <p className="mb-4 max-w-sm rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <LoginForm mockMode={!isSupabaseConfigured} />
      </main>
    </div>
  );
}
