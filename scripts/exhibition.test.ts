import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { publishedBooks, getPublishedBook } from '../src/lib/exhibition/catalog';

test('only the explicitly approved book is published, with cover and 28 original PNG pages', () => {
  assert.equal(publishedBooks.length, 1);
  const book = getPublishedBook('planet-friends');
  assert.ok(book);
  assert.equal(book.title, '행성 친구들의 우당당탕 여행');
  assert.equal(book.pages.length, 29);
  for (const page of book.pages) {
    const data = readFileSync(`public${page.src}`);
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16), page.width);
    assert.equal(data.readUInt32BE(20), page.height);
  }
  for (const slug of ['private-book', 'toString', '__proto__', '../planet-friends', '']) {
    assert.equal(getPublishedBook(slug), undefined);
  }
});
