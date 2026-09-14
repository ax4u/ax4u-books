// Publication requires renewed, explicit approval. Withdrawn originals are
// preserved locally and in the private incident backup, not imported here.
export type ExhibitionBook = {
  slug: string;
  title: string;
  description: string;
  pages: readonly { src: string; width: number; height: number; label: string }[];
};

export const publishedBooks: readonly ExhibitionBook[] = [];

export function getPublishedBook(slug: string) {
  return publishedBooks.find((book) => book.slug === slug);
}
