import { redirect } from "next/navigation";
import Header from "@/app/components/Header";
import CreateForm from "./CreateForm";
import { getSessionUser } from "@/lib/auth";
import { isPolarConfigured } from "@/lib/env";

export default async function CreatePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="mb-2 text-2xl font-bold">새 그림책 만들기</h1>
        <p className="mb-8 text-sm text-zinc-500">
          주제와 옵션을 정하면, 결제 후 AI가 글과 그림을 생성합니다.
        </p>
        <CreateForm mockPayment={!isPolarConfigured} />
      </main>
    </div>
  );
}
