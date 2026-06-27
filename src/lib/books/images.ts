import type { BookPage } from "./types";

export function hasPageImage(page: BookPage): boolean {
  return Boolean(page.imagePath || page.image);
}

export function pageImageSrc(bookId: string, page: BookPage): string | null {
  if (page.image) return page.image;
  if (page.imagePath) return `/api/books/${bookId}/assets/${page.index}`;
  return null;
}

export function coverImageSrc(bookId: string, coverImagePath: string | null) {
  return coverImagePath ? `/api/books/${bookId}/cover` : null;
}
