import { notFound, redirect } from "next/navigation";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import ui from "@/app/studio.module.css";
import GobibiArt from "@/app/components/gobibi/GobibiArt";
import BookView from "./BookView";
import { getSessionUser } from "@/lib/auth";
import { stripInlineImagesForClient } from "@/lib/books/images";
import { getBook } from "@/lib/books/store";

export const metadata = { title: "내 그림책 독서실 | GOBIBI" };

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
    <GobibiShell theme="cream" className={ui.brand}>
      <main id="main" className={ui.readerMain}>
        <aside className={ui.privateWorld} aria-label="상멍이의 작은 독서실"><p><strong>이야기 옆에서, 함께.</strong>상멍이와 한 장씩 읽고 다듬어 보세요.<br />완성된 책도 자동으로 공개 전시되지 않아요.</p><GobibiArt scene="library" quiet /></aside>
        <BookView book={stripInlineImagesForClient(book)} />
      </main>
    </GobibiShell>
  );
}
