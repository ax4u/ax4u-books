import { notFound, redirect } from "next/navigation";
import Header from "@/app/components/Header";
import BookView from "./BookView";
import { getSessionUser } from "@/lib/auth";
import { getBook } from "@/lib/books/store";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const book = await getBook(id);
  if (!book || book.userId !== user.id) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <BookView book={book} />
      </main>
    </div>
  );
}
