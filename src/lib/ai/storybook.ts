import { getAIProvider } from "./index";
import { getBook, updateBook } from "@/lib/books/store";
import type { BookPage } from "@/lib/books/types";

/**
 * Full generation pipeline for one book: plan the story, illustrate every page,
 * then persist title + pages. Updates `status` as it goes so the UI can poll.
 *
 * Safe to call from a Route Handler `after()` callback or the Polar webhook.
 * Pass `admin: true` when there's no user session (webhook path).
 */
export async function runGeneration(
  bookId: string,
  opts: { admin?: boolean } = {},
): Promise<void> {
  const admin = opts.admin ?? false;
  const book = await getBook(bookId, { admin });
  if (!book) throw new Error(`runGeneration: book ${bookId} not found`);

  // Only generate once for a paid/queued book.
  if (book.status === "generating" || book.status === "completed") return;

  const provider = getAIProvider();

  try {
    await updateBook(bookId, { status: "generating", error: null }, { admin });

    const plan = await provider.generateStory(book.topic, book.options);

    const pages: BookPage[] = [];
    for (let i = 0; i < plan.pages.length; i++) {
      const p = plan.pages[i];
      const image = await provider.generateImage(p.imagePrompt, book.options);
      pages.push({ index: i, text: p.text, image });
      // Persist incrementally so the UI can show progress while later pages
      // are still rendering.
      await updateBook(
        bookId,
        { title: plan.title, pages, status: "generating" },
        { admin },
      );
    }

    await updateBook(
      bookId,
      { title: plan.title, pages, status: "completed" },
      { admin },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[storybook] generation failed for ${bookId}:`, err);
    await updateBook(bookId, { status: "failed", error: message }, { admin });
    throw err;
  }
}
