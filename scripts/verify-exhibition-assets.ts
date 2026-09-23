import assert from 'node:assert/strict';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { publishedBooks } from '../src/lib/exhibition/catalog';
import { approvedTitles } from '../src/lib/exhibition/schema';

async function main() {
  if (!publishedBooks.length && process.argv.includes('--allow-empty')) {
    console.log('PREPARATION ONLY: empty catalog; actual book assets are not verified.');
    return;
  }
  assert.equal(publishedBooks.length, approvedTitles.length, 'Publication requires all approved books; empty preparation catalog cannot deploy.');
  const root = realpathSync('public');
  const expected = new Set<string>();
  const hashes: Record<string, string> = {};
  function readAsset(src: string) {
    const path = realpathSync(resolve(root, `.${src}`));
    assert.ok(path.startsWith(root + sep), 'asset escapes public root');
    expected.add(src);
    const data = readFileSync(path);
    hashes[src] = createHash('sha256').update(data).digest('hex');
    return data;
  }
  const pageCounts: Record<string, number> = { 'love-treatment-epilogue': 43, 'mom-dreamed-grownup': 27, 'sangmung-haeon-back-to-sea': 65, 'buildergarlic-garlic-robot-alli': 16, 'sangmung-paper-boat-promise': 35, 'bori-first-water-play': 29, 'team04-huchu-berry': 34 };
  for (const book of publishedBooks) {
    assert.equal(book.pages.length, pageCounts[book.slug], 'approved page count');
    for (const [index, page] of book.pages.entries()) {
      assert.equal(page.src, `/published-exhibition/${book.slug}/page-${String(index).padStart(3, '0')}.webp`, 'original page order');
      const meta = await sharp(readAsset(page.src)).metadata();
      assert.equal(meta.format, 'webp', page.src);
      assert.equal(meta.width, page.width, page.src);
      assert.equal(meta.height, page.height, page.src);
    }
    if (book.fullCover) {
      const meta = await sharp(readAsset(book.fullCover.src)).metadata();
      assert.equal(meta.format, 'webp', book.fullCover.src);
      assert.equal(meta.width, book.fullCover.width, book.fullCover.src);
      assert.equal(meta.height, book.fullCover.height, book.fullCover.src);
    }
    if (book.readingPdf) assert.equal(readAsset(book.readingPdf).subarray(0, 5).toString(), '%PDF-', book.readingPdf);
  }
  const assets = readdirSync('public/published-exhibition', { recursive: true, withFileTypes: true });
  for (const item of assets) {
    assert.equal(item.isSymbolicLink(), false, 'symlink in public assets');
    if (item.isFile()) {
      const src = '/' + resolve(item.parentPath, item.name).slice(root.length + 1).split(sep).join('/');
      assert.ok(expected.has(src), `unexpected public asset: ${src}`);
    }
  }
  console.log(JSON.stringify({ verifiedBooks: publishedBooks.length, assetCount: expected.size, sha256: hashes }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
