import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvedTitles, exhibitionCatalogSchema } from '../src/lib/exhibition/schema';

// Metadata-only fixtures. No artwork, public files, or catalog entries are generated.
const fixture = () => approvedTitles.map((title, i) => {
  const slug = `test-book-${i}`;
  const page = { src: `/published-exhibition/${slug}/cover.webp`, width: 600, height: 800, label: '앞표지' };
  return { slug, title, description: '테스트 전용 소개', author: '테스트 전용 저자', cover: page, readingPdf: `/published-exhibition/${slug}/reading.pdf`, pages: [page, { ...page, src: `/published-exhibition/${slug}/page-1.webp`, label: '본문 1쪽' }] };
});
test('empty preparation state and exactly three approved works validate', () => {
  assert.equal(exhibitionCatalogSchema.parse([]).length, 0);
  assert.equal(exhibitionCatalogSchema.parse(fixture()).length, 3);
  assert.equal(exhibitionCatalogSchema.parse(fixture().map(({ readingPdf, ...book }) => { void readingPdf; return book; })).length, 3);
});
test('incomplete, duplicate, withdrawn and unsafe catalogs fail closed', () => {
  assert.equal(exhibitionCatalogSchema.safeParse(fixture().slice(0, 2)).success, false);
  const mutations = [
    (b: ReturnType<typeof fixture>) => { b[0].slug = 'planet-friends'; },
    (b: ReturnType<typeof fixture>) => { b[1].title = b[0].title; },
    (b: ReturnType<typeof fixture>) => { b[0].readingPdf = 'javascript:alert(1)'; },
    (b: ReturnType<typeof fixture>) => { b[0].pages[1].width = 0; },
    (b: ReturnType<typeof fixture>) => { b[0].pages = [b[0].cover]; },
    (b: ReturnType<typeof fixture>) => { b[0].pages[1].src = '/published-exhibition/test-book-0/../secret.webp'; },
    (b: ReturnType<typeof fixture>) => { b[0].pages[1].src = b[0].cover.src; },
    (b: ReturnType<typeof fixture>) => { b[0].author = ''; },
    (b: ReturnType<typeof fixture>) => { b[0].cover = { ...b[0].cover, width: 900 }; },
  ];
  for (const mutate of mutations) { const books = fixture(); mutate(books); assert.equal(exhibitionCatalogSchema.safeParse(books).success, false); }
});
