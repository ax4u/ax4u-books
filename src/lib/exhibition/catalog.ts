import pages from './pages.json';

// Publication is a deliberate, reviewed code change. Never query users' books here.
// This catalog and all files in public/exhibition are intentionally public.
export const publishedBooks = [{
  slug: 'planet-friends',
  title: '행성 친구들의 우당당탕 여행',
  description: '행성 친구들과 함께 떠나는 우당당탕 여행. 표지부터 마지막 장까지, 천천히 펼쳐 보세요.',
  pages,
}] as const;

export type ExhibitionBook = (typeof publishedBooks)[number];
export function getPublishedBook(slug: string) {
  return publishedBooks.find((book) => book.slug === slug);
}
