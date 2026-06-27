import { markBookPageImageStored } from "@/lib/books/store";
import { storePageImage } from "./assets";
import type { Book, BookPage } from "./types";

export async function persistInlinePageImage(
  book: Book,
  page: BookPage,
): Promise<BookPage> {
  if (!page.image) return page;

  const stored = await storePageImage(book.id, page.index, page.image);
  if (!stored) return page;

  await markBookPageImageStored(book.id, page.index, stored);

  return {
    ...page,
    image: null,
    imagePath: stored.path,
    imageMime: stored.mimeType,
    imageWidth: stored.width,
    imageHeight: stored.height,
    imageBytes: stored.byteSize,
  };
}
