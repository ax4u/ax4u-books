import { getSessionUser } from "@/lib/auth";
import { getBook } from "@/lib/books/store";
import { generateBookPdf } from "@/lib/pdf/generate";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }
  if (book.status !== "completed") {
    return new Response("Book is not ready yet", { status: 409 });
  }

  const pdf = await generateBookPdf(book);
  const filename = `${(book.title || book.topic || "storybook")
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .slice(0, 60)
    .trim() || "storybook"}.pdf`;

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
