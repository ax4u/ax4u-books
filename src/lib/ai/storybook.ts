import { getAIProvider } from "./index";
import { getBook, updateBook } from "@/lib/books/store";
import type { BookPage } from "@/lib/books/types";
import { buildConsistentImagePrompt, type ImageReference } from "./types";

/**
 * Generation pipeline for one book — designed to be **resumable**.
 *
 * Image models can be slow, so a multi-page book can exceed a serverless
 * function's time limit. To cope, this function:
 *   1. Plans the story ONCE and persists every page's text + image prompt.
 *   2. Fills in missing illustrations in page order, saving after each.
 * If the invocation is killed mid-way, the book keeps its finished pages and a
 * later call simply continues with the pages that still need an image. This
 * makes it safe to re-trigger (from the webhook, the generate route, or the
 * client's stall-retry) until the book is complete.
 *
 * We intentionally do not batch image generation here. Character continuity is
 * more important than raw speed for a picture book, so each new image receives
 * the first finished image and the previous finished image as visual references.
 *
 * Pass `admin: true` when there's no user session (webhook path).
 */
export async function runGeneration(
  bookId: string,
  opts: { admin?: boolean } = {},
): Promise<void> {
  const admin = opts.admin ?? false;
  let book = await getBook(bookId, { admin });
  if (!book) throw new Error(`runGeneration: book ${bookId} not found`);
  if (book.status === "completed") return;

  const provider = getAIProvider();

  try {
    // 1. Plan the story once (idempotent: only if we have no pages yet).
    if (book.pages.length === 0) {
      await updateBook(bookId, { status: "generating", error: null }, { admin });
      const plan = await provider.generateStory(book.topic, book.options);
      const pages: BookPage[] = plan.pages.map((p, i) => ({
        index: i,
        text: p.text,
        imagePrompt: buildConsistentImagePrompt({
          characterSheet: plan.characterSheet,
          pagePrompt: p.imagePrompt,
          options: book!.options,
          pageNumber: i + 1,
        }),
        image: null,
      }));
      book = await updateBook(
        bookId,
        { title: plan.title, pages, status: "generating" },
        { admin },
      );
    } else if (book.status !== "generating") {
      await updateBook(bookId, { status: "generating", error: null }, { admin });
    }

    // 2. Fill in missing illustrations in order. The first image establishes
    //    the character reference; later pages get both the first and previous
    //    images as references so the model has a concrete visual anchor.
    const pages = [...book.pages].sort((a, b) => a.index - b.index);
    let firstReference = pages.find((p) => p.image)?.image ?? null;
    let previousReference: string | null = null;

    for (const page of pages) {
      if (page.image) {
        previousReference = page.image;
        continue;
      }

      const references = buildImageReferences(firstReference, previousReference);
      const prompt = page.imagePrompt ?? page.text;
      page.image = await provider.generateImage(
        prompt,
        book.options,
        references,
      );
      firstReference ??= page.image;
      previousReference = page.image;
      await updateBook(bookId, { pages, status: "generating" }, { admin });
    }

    // 3. Mark complete only when every page has an illustration.
    const fresh = await getBook(bookId, { admin });
    if (fresh && fresh.pages.length > 0 && fresh.pages.every((p) => p.image)) {
      await updateBook(bookId, { status: "completed" }, { admin });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[storybook] generation failed for ${bookId}:`, err);
    await updateBook(bookId, { status: "failed", error: message }, { admin });
    throw err;
  }
}

function buildImageReferences(
  firstReference: string | null,
  previousReference: string | null,
): ImageReference[] {
  const references: ImageReference[] = [];
  if (firstReference) {
    references.push({ dataUrl: firstReference, label: "first page reference" });
  }
  if (previousReference && previousReference !== firstReference) {
    references.push({
      dataUrl: previousReference,
      label: "previous page reference",
    });
  }
  return references;
}
