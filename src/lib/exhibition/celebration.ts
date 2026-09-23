import { publishedBooks } from './catalog';

export const celebrationNames = ['옥주완', '성시아 & 성지아', '김도연', '정하윤 & 정윤서'] as const;

// Only reuse artwork in the current, approved public catalog. Other honorees'
// unpublished/withdrawn books are deliberately not imported or attributed here.
const book = publishedBooks.find(book => book.slug === 'bori-first-water-play');
export const celebrationArtwork = book ? [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25].map(index => ({
  src: book.pages[index].src,
  width: book.pages[index].width,
  height: book.pages[index].height,
  title: book.title,
  author: book.author,
  slug: book.slug,
})) : [];

export const celebrationMusic = {
  src: '/audio/celebration/mozart-k545-musopen.mp3',
  title: 'Mozart · Piano Sonata No. 16, K.545 — I. Allegro',
  credit: 'Musopen',
  source: 'https://commons.wikimedia.org/wiki/File:Wolfgang_Amadeus_Mozart_-_sonata_no._16_in_c_major,_k.545_%27sonata_facile%27_-_i._allegro.ogg',
  license: 'Public domain · Musopen / Wikimedia Commons (VRT 2008012110017088)',
};
