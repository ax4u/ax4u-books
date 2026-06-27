import { getSessionUser } from "@/lib/auth";
import { hasPageImage } from "@/lib/books/images";
import { getBook } from "@/lib/books/store";

/** Lightweight status endpoint the book page polls during generation. */
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

  return Response.json({
    id: book.id,
    status: book.status,
    title: book.title,
    pageCount: book.options.pageCount,
    pagesReady: book.pages.length,
    imagesReady: book.pages.filter(hasPageImage).length,
    updatedAt: book.updatedAt,
    error: book.error,
  });
}
