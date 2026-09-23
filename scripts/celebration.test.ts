import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('celebration entry point is implemented without changing the public catalog', async () => {
  assert.ok(existsSync(resolve('src/app/exhibition/celebration/page.tsx')), 'missing celebration route');
  const { celebrationNames, celebrationArtwork, celebrationMusic } = await import('../src/lib/exhibition/celebration');
  assert.deepEqual(celebrationNames, ['옥주완', '성시아 & 성지아', '김도연', '정하윤 & 정윤서']);
  const books = JSON.parse(readFileSync('src/lib/exhibition/public-books.json', 'utf8'));
  assert.ok(celebrationArtwork.length >= 8);
  for (const art of celebrationArtwork) {
    const book = books.find((b: {slug: string}) => b.slug === art.slug);
    assert.ok(book);
    assert.equal(book.author, art.author);
    assert.ok(book.pages.some((p: {src: string}) => p.src === art.src));
    assert.ok(existsSync(resolve('public' + art.src)));
    assert.ok(!art.src.includes('planet-friends'));
  }
  assert.ok(existsSync(resolve('public' + celebrationMusic.src)));
  assert.match(celebrationMusic.source, /^https:\/\/commons.wikimedia.org\//);
});
