import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('four celebration-only approved attachments preserve names, ratios and withdrawal', async () => {
  const { celebrationNames, celebrationArtwork, celebrationMusic } = await import('../src/lib/exhibition/celebration');
  assert.deepEqual(celebrationNames, ['옥주완 (옥수수)', '성시아 & 성지아', '김도연', '정하윤 & 정윤서']);
  assert.equal(celebrationArtwork.length, 4);
  assert.deepEqual(celebrationArtwork.map(a => [a.width, a.height]), [[1722,913],[1721,914],[1254,1254],[1200,1200]]);
  for (const [i, art] of celebrationArtwork.entries()) {
    assert.equal(art.src, `/celebration-art/attachment-${i+1}.webp`);
    assert.ok(existsSync(resolve('public' + art.src)));
  }
  const books = JSON.parse(readFileSync('src/lib/exhibition/public-books.json', 'utf8'));
  assert.ok(!books.some((b: {slug: string}) => b.slug === 'planet-friends'));
  assert.ok(existsSync(resolve('public' + celebrationMusic.src)));
  assert.match(readFileSync('src/app/exhibition/celebration/celebration.module.css', 'utf8'), /object-fit: contain/);
});
