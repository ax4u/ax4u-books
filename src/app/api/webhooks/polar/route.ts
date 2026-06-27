import { after } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { env, isPolarConfigured } from "@/lib/env";
import { getBook, getBookByCheckoutId, updateBook } from "@/lib/books/store";
import { runGeneration } from "@/lib/ai/storybook";

export const maxDuration = 300;

/**
 * Polar webhook. On a successful one-time payment it marks the corresponding
 * book as paid and kicks off generation in the background via `after()`.
 */
export async function POST(request: Request) {
  if (!isPolarConfigured || !env.polarWebhookSecret) {
    return new Response("Polar not configured", { status: 503 });
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let event: any;
  try {
    event = validateEvent(body, headers, env.polarWebhookSecret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return new Response("Invalid signature", { status: 403 });
    }
    throw err;
  }

  const paid =
    event.type === "order.paid" ||
    (event.type === "checkout.updated" && event.data?.status === "succeeded") ||
    (event.type === "order.created" && event.data?.paid === true);

  if (paid) {
    const data = event.data ?? {};
    const bookId: string | undefined =
      data.metadata?.bookId ?? data.checkout?.metadata?.bookId;
    const checkoutId: string | undefined = data.checkoutId ?? data.checkout_id;

    const book = bookId
      ? await getBook(bookId, { admin: true })
      : checkoutId
        ? await getBookByCheckoutId(checkoutId)
        : null;

    if (book && book.status === "draft") {
      await updateBook(book.id, { status: "paid" }, { admin: true });
      after(() => runGeneration(book.id, { admin: true }));
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return new Response("ok", { status: 200 });
}
