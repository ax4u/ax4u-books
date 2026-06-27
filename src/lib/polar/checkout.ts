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

  const checkout = await polar.checkouts.create({
    products: [env.polarProductId!],
    successUrl: `${env.appUrl}/books/${book.id}?paid=1`,
    customerEmail: user.email,
    metadata: { bookId: book.id, userId: user.id },
  });

  await updateBook(book.id, { checkoutId: checkout.id });

  return { url: checkout.url };
}
