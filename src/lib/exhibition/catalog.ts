import publicBooks from "./public-books.json";
import { exhibitionCatalogSchema } from "./schema";
export type { ExhibitionBook } from "./schema";

// Public metadata only. Never import private source/approval manifests here.
// Keep empty until the final source manifest has been mapped and verified.
export const publishedBooks = exhibitionCatalogSchema.parse(publicBooks);

export function getPublishedBook(slug: string) {
  return publishedBooks.find((book) => book.slug === slug);
}
