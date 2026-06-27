import { after, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBook, updateBook } from "@/lib/books/store";
import {
  enqueueGenerationJob,
  processGenerationJobs,
} from "@/lib/jobs/generation";
import { env, isPolarConfigured } from "@/lib/env";

export const maxDuration = 300;

/**
 * Mock checkout used when Polar is not configured. Instantly "pays" for the
 * book and starts generation, then redirects to the book page. Disabled once
 * real Polar credentials are present.
 */
export async function GET(request: Request) {
  if (isPolarConfigured) {
    return new Response("Mock pay disabled (Polar is configured)", {
      status: 404,
    });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(`${env.appUrl}/login`);
  }

  const bookId = new URL(request.url).searchParams.get("bookId");
  if (!bookId) return new Response("Missing bookId", { status: 400 });

  const book = await getBook(bookId);
  if (!book || book.userId !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  if (book.status === "draft") {
    await updateBook(bookId, { status: "paid" });
    await enqueueGenerationJob({
      bookId,
      userId: user.id,
      type: "book",
    });
    after(() => processGenerationJobs({ limit: 1 }));
  }

  return NextResponse.redirect(`${env.appUrl}/books/${bookId}?paid=1`);
}
