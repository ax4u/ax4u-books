import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { publishedBooks } from '../src/lib/exhibition/catalog';

test('one browser-only flipbook owns page state across desktop and mobile', () => {
  const entry = readFileSync('src/app/exhibition/[slug]/ResponsiveReader.tsx','utf8');
  assert.ok(entry.includes('import("./MobileReader")'));
  assert.ok(entry.includes('ssr: false'));
  assert.ok(!entry.includes('matchMedia'));
  assert.ok(readFileSync('src/app/exhibition/[slug]/MobileReader.tsx','utf8').includes('data-mobile-reader'));
});
test('all approved source pages are ordered, unique and cover independently selected', () => {
  assert.deepEqual(publishedBooks.map(b=>b.pages.length),[43,27,65,16,35,29,34]);
  for(const b of publishedBooks) {
    assert.equal(b.cover.src,b.pages[b.coverPageIndex ?? 0].src);
    assert.equal(new Set(b.pages.map(p=>p.src)).size,b.pages.length);
    const order = b.slug === 'team04-huchu-berry' ? [2,0,1,...Array.from({length:31},(_,i)=>i+3)] : b.pages.map((_,i)=>i);
    b.pages.forEach((p,i)=>assert.ok(p.src.endsWith(`page-${String(order[i]).padStart(3,'0')}.webp`)));
    if (b.slug === 'team04-huchu-berry') {
      assert.equal(b.coverPageIndex,0);
      assert.deepEqual(b.cover,b.pages[0]);
      assert.deepEqual(b.pages.slice(0,3).map(p=>p.label),['1쪽 · 표지','2쪽 · 패턴','3쪽 · 패턴']);
    }
  }
});
