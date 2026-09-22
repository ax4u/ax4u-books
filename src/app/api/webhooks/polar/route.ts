import { after } from "next/server";
import { FREE_EXHIBITION_ONLY, exhibitionOnlyResponse } from "@/lib/exhibition-mode";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { env, isPolarConfigured } from "@/lib/env";
import { getBook, getBookByCheckoutId, updateBook } from "@/lib/books/store";
import {
  enqueueGenerationJob,
  processGenerationJobs,
} from "@/lib/jobs/generation";

export const maxDuration = 300;

/**
 * Polar webhook. On a successful one-time payment it marks the corresponding
 * book as paid and kicks off generation in the background via `after()`.
 */
export async function POST(request: Request) {
  if (FREE_EXHIBITION_ONLY) return exhibitionOnlyResponse();
  if (!isPolarConfigured || !env.polarWebhookSecret) {
    return new Response("Polar not configured", { status: 503 });
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  const event = validatePolarEvent(body, headers, env.polarWebhookSecret);
  if (!event) return new Response("Invalid signature", { status: 403 });

  switch (event.type) {
    case "order.paid":
      await confirmPaidBook({
        eventType: event.type,
        bookId: readStringMetadata(event.data.metadata, "bookId"),
        userId: readStringMetadata(event.data.metadata, "userId"),
        productId: event.data.productId ?? undefined,
        checkoutId: event.data.checkoutId ?? undefined,
      });
      break;

    case "order.created":
      if (event.data.paid) {
        await confirmPaidBook({
          eventType: event.type,
          bookId: readStringMetadata(event.data.metadata, "bookId"),
        userId: readStringMetadata(event.data.metadata, "userId"),
        productId: event.data.productId ?? undefined,
          checkoutId: event.data.checkoutId ?? undefined,
        });
      }
      break;

    case "checkout.updated":
      if (event.data.status === "succeeded") {
        await confirmPaidBook({
          eventType: event.type,
          bookId: readStringMetadata(event.data.metadata, "bookId"),
        userId: readStringMetadata(event.data.metadata, "userId"),
        productId: event.data.productId ?? undefined,
          checkoutId: event.data.id,
        });
      }
      break;

    default:
      console.log(
        JSON.stringify({
          level: "info",
          msg: "ignored_polar_webhook",
          eventType: event.type,
        }),
      );
  }

  return new Response("ok", { status: 200 });
}

function validatePolarEvent(
  body: string,
  headers: Record<string, string>,
  secrets: string,
): ReturnType<typeof validateEvent> | null {
  for (const secret of secrets
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    try {
      return validateEvent(body, headers, secret);
    } catch (err) {
      if (!(err instanceof WebhookVerificationError)) throw err;
    }
  }

  return null;
}

function readStringMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function confirmPaidBook({
  eventType,
  bookId,
  checkoutId,
  userId,
  productId,
}: {
  eventType: string;
  bookId?: string;
  checkoutId?: string;
  userId?: string;
  productId?: string;
}) {
  const book = bookId
    ? await getBook(bookId, { admin: true })
    : checkoutId
      ? await getBookByCheckoutId(checkoutId)
      : null;

  if (!book) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "polar_paid_book_not_found",
        eventType,
        bookId,
        checkoutId,
      }),
    );
    return;
  }

  // A valid signature authenticates Polar, not arbitrary metadata. Bind the
  // event to the checkout saved for this book and to the configured product.
  if (!checkoutId || productId !== env.polarProductId ||
      (userId !== undefined && userId !== book.userId) ||
      (book.checkoutId !== null && book.checkoutId !== checkoutId)) {
    console.warn("[polar] Ignored payment with mismatched book/checkout/product");
    return;
  }
  // Checkout persistence may race an early webhook: retry, never grant blindly.
  if (!book.checkoutId) throw new Error("Book checkout is not persisted yet");

  if (book.status !== "draft" && book.status !== "paid") {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "polar_paid_book_already_processed",
        eventType,
        bookId: book.id,
        checkoutId,
        status: book.status,
      }),
    );
    return;
  }

  if (book.status === "draft") {
    await updateBook(book.id, { status: "paid" }, { admin: true });
  }
  // Retrying an event after a queue failure must repair a paid-but-unqueued book.
  // enqueueGenerationJob deduplicates active jobs.
  await enqueueGenerationJob({
    bookId: book.id,
    userId: book.userId,
    type: "book",
  });
  after(() => processGenerationJobs({ limit: 1 }));

  console.log(
    JSON.stringify({
      level: "info",
      msg: "polar_paid_book_queued",
      eventType,
      bookId: book.id,
      checkoutId,
    }),
  );
}
