import type { Book, BookPage } from "./types";

export function hasPageImage(page: BookPage): boolean {
  return Boolean(page.imagePath || page.image || page.imageAvailable);
}

export function pageImageSrc(bookId: string, page: BookPage): string | null {
  if (hasPageImage(page)) return `/api/books/${bookId}/assets/${page.index}`;
  return null;
}

export function coverImageSrc(
  bookId: string,
  coverImagePath: string | null,
  coverImageAvailable = false,
) {
  return coverImagePath || coverImageAvailable
    ? `/api/books/${bookId}/cover`
    : null;
}

export function stripInlineImagesForClient(book: Book): Book {
  return {
    ...book,
    pages: book.pages.map(stripInlinePageImage),
  };
}

function stripInlinePageImage(page: BookPage): BookPage {
  if (!page.image) {
    return {
      ...page,
      imageAvailable: Boolean(page.imagePath || page.imageAvailable),
    };
  }

  return {
    ...page,
    image: null,
    imageAvailable: true,
  };
}
