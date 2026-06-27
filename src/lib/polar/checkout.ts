import { getPolarClient } from "./client";
import { updateBook } from "@/lib/books/store";
import { env } from "@/lib/env";
import type { Book } from "@/lib/books/types";
import type { SessionUser } from "@/lib/auth";

/**
 * Create a one-time checkout for a single book. Returns the URL to redirect the
 * buyer to. When Polar isn't configured, returns a local mock-pay URL that
 * instantly confirms payment so the flow is demoable offline.
 */
export async function createBookCheckout(
  book: Book,
  user: SessionUser,
): Promise<{ url: string }> {
  const polar = getPolarClient();

  if (!polar) {
    // Mock payment: a local route that marks the book paid and starts generation.
    return { url: `${env.appUrl}/api/mock-pay?bookId=${book.id}` };
  }

  const successUrl = new URL(`/books/${book.id}`, env.appUrl);
  successUrl.searchParams.set("paid", "1");
  successUrl.searchParams.set("checkout_id", "{CHECKOUT_ID}");

  const checkout = await polar.checkouts.create({
    products: [env.polarProductId!],
    successUrl: successUrl.toString(),
    returnUrl: `${env.appUrl}/create`,
    customerEmail: user.email,
    externalCustomerId: user.id,
    metadata: { bookId: book.id, userId: user.id },
  });

  await updateBook(book.id, { checkoutId: checkout.id });

  return { url: checkout.url };
}
