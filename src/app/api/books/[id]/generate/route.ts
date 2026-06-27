import { after } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBook, updateBook } from "@/lib/books/store";
import { runGeneration } from "@/lib/ai/storybook";

// Image generation is slow; give the background work as much time as the plan
// allows. Generation is resumable, so the client re-triggers if this is hit.
export const maxDuration = 300;

/**
 * Manual generation trigger. Useful for paid books whose webhook hasn't been
 * received yet (e.g. local Polar testing) or to retry a failed generation.
 */
export async function POST(
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
  if (book.status === "draft") {
    return new Response("Payment required", { status: 402 });
  }
  if (book.status === "generating" || book.status === "completed") {
    return Response.json({ status: book.status });
  }

  // status is 'paid' or 'failed' → (re)start generation.
  await updateBook(id, { status: "paid", error: null });
  after(() => runGeneration(id));
  return Response.json({ status: "generating" });
}
