import { getAIProvider } from "./index";
import { env } from "@/lib/env";
import {
  deleteStoredAssets,
  pageImageDataUrl,
  storePageImage,
} from "@/lib/books/assets";
import { hasPageImage } from "@/lib/books/images";
import { getBook, updateBook } from "@/lib/books/store";
import type { Book, BookPage } from "@/lib/books/types";
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
 * The first finished image establishes the visual reference; remaining missing
 * pages are generated with limited concurrency against that reference.
 *
 * Pass `admin: true` when there's no user session (webhook path).
 */
export async function runGeneration(
  bookId: string,
  opts: { admin?: boolean } = {},
): Promise<void> {
  const admin = opts.admin ?? false;
  const initialBook = await getBook(bookId, { admin });
  if (!initialBook) throw new Error(`runGeneration: book ${bookId} not found`);
  let book = initialBook;
  if (book.status === "completed" && book.pages.every(hasPageImage)) return;

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
        imagePath: null,
        imageMime: null,
        imageWidth: null,
        imageHeight: null,
        imageBytes: null,
      }));
      book = await updateBook(
        bookId,
        { title: plan.title, pages, status: "generating" },
        { admin },
      );
    } else if (book.status !== "generating") {
      await updateBook(bookId, { status: "generating", error: null }, { admin });
    }

    // 2. Fill in missing illustrations. The first finished image establishes
    //    the character reference; later pages can be generated in parallel
    //    against that stable reference instead of waiting on each other.
    const pages = [...book.pages].sort((a, b) => a.index - b.index);
    let firstReference = await firstAvailableReference(pages);

    const firstPage = pages[0];
    if (!firstReference && firstPage && !hasPageImage(firstPage)) {
      firstReference = await generateAndPersistPage({
        book,
        page: firstPage,
        pages,
        references: [],
        admin,
      });
    }

    const missing = pages.filter((page) => !hasPageImage(page));
    await runInBatches(missing, imageConcurrency(), async (page) => {
      await generateAndPersistPage({
        book,
        page,
        pages,
        references: buildImageReferences(firstReference, null),
        admin,
      });
    });

    // 3. Mark complete only when every page has an illustration.
    const fresh = await getBook(bookId, { admin });
    if (fresh && fresh.pages.length > 0 && fresh.pages.every(hasPageImage)) {
      await updateBook(bookId, { status: "completed" }, { admin });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[storybook] generation failed for ${bookId}:`, err);
    await updateBook(bookId, { status: "failed", error: message }, { admin });
    throw err;
  }
}

export async function runPageRegeneration(
  bookId: string,
  pageIndex: number,
  opts: { admin?: boolean } = {},
): Promise<void> {
  const admin = opts.admin ?? false;
  const book = await getBook(bookId, { admin });
  if (!book) throw new Error(`runPageRegeneration: book ${bookId} not found`);

  const pages = [...book.pages].sort((a, b) => a.index - b.index);
  const page = pages.find((p) => p.index === pageIndex);
  if (!page) {
    throw new Error(`runPageRegeneration: page ${pageIndex} not found`);
  }

  await updateBook(bookId, { status: "generating", error: null }, { admin });

  const oldPath = page.imagePath ?? null;
  const firstReference = await firstAvailableReference(
    pages.filter((p) => p.index !== pageIndex),
  );

  await generateAndPersistPage({
    book,
    page,
    pages,
    references: buildImageReferences(firstReference, null),
    admin,
  });

  if (oldPath && oldPath !== page.imagePath) {
    await deleteStoredAssets([oldPath]);
  }

  const fresh = await getBook(bookId, { admin });
  if (fresh && fresh.pages.length > 0 && fresh.pages.every(hasPageImage)) {
    await updateBook(bookId, { status: "completed" }, { admin });
  }
}

async function generateAndPersistPage({
  book,
  page,
  pages,
  references,
  admin,
}: {
  book: Book;
  page: BookPage;
  pages: BookPage[];
  references: ImageReference[];
  admin: boolean;
}): Promise<string> {
  const provider = getAIProvider();
  const prompt = page.imagePrompt ?? page.text;
  const dataUrl = await provider.generateImage(prompt, book.options, references);
  const stored = await storePageImage(book.id, page.index, dataUrl);

  if (stored) {
    page.image = null;
    page.imagePath = stored.path;
    page.imageMime = stored.mimeType;
    page.imageWidth = stored.width;
    page.imageHeight = stored.height;
    page.imageBytes = stored.byteSize;
  } else {
    page.image = dataUrl;
    page.imagePath = null;
    page.imageMime = null;
    page.imageWidth = null;
    page.imageHeight = null;
    page.imageBytes = null;
  }

  await updateBook(
    book.id,
    {
      pages,
      status: "generating",
      coverImagePath: pages.find((p) => p.imagePath)?.imagePath ?? null,
      pdfPath: null,
    },
    { admin },
  );

  return dataUrl;
}

async function firstAvailableReference(
  pages: BookPage[],
): Promise<string | null> {
  for (const page of pages) {
    const dataUrl = await pageImageDataUrl(page);
    if (dataUrl) return dataUrl;
  }
  return null;
}

function imageConcurrency(): number {
  return Math.max(1, Math.min(4, Math.floor(env.imageGenerationConcurrency)));
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(worker));
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
