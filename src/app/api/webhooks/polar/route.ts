import { after } from "next/server";
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
        checkoutId: event.data.checkoutId ?? undefined,
      });
      break;

    case "order.created":
      if (event.data.paid) {
        await confirmPaidBook({
          eventType: event.type,
          bookId: readStringMetadata(event.data.metadata, "bookId"),
          checkoutId: event.data.checkoutId ?? undefined,
        });
      }
      break;

    case "checkout.updated":
      if (event.data.status === "succeeded") {
        await confirmPaidBook({
          eventType: event.type,
          bookId: readStringMetadata(event.data.metadata, "bookId"),
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
}: {
  eventType: string;
  bookId?: string;
  checkoutId?: string;
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

  if (book.status !== "draft") {
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

  await updateBook(book.id, { status: "paid", checkoutId }, { admin: true });
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
