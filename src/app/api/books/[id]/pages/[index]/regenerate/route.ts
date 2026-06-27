import { after } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBook, updateBook } from "@/lib/books/store";
import {
  enqueueGenerationJob,
  processGenerationJobs,
} from "@/lib/jobs/generation";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await ctx.params;
  const pageIndex = Number(index);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return new Response("Invalid page index", { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const book = await getBook(id);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }
  if (book.status === "draft") {
    return new Response("Payment required", { status: 402 });
  }
  if (!book.pages.some((page) => page.index === pageIndex)) {
    return new Response("Page not found", { status: 404 });
  }

  await updateBook(id, { status: "generating", error: null, pdfPath: null });
  await enqueueGenerationJob({
    bookId: id,
    userId: user.id,
    type: "page",
    pageIndex,
  });
  after(() => processGenerationJobs({ limit: 1 }));

  return Response.json({ ok: true, status: "generating" });
}
