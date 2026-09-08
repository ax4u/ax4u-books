import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { brandSocialMetadata, SHARE_IMAGE, SITE_TITLE } from '../src/lib/site-metadata';

const root = process.cwd();
test('one absolute, versioned homepage key visual is the only Open Graph image', () => {
  assert.deepEqual(brandSocialMetadata.openGraph.images, [SHARE_IMAGE]);
  assert.match(SHARE_IMAGE.url, /^https:\/\/gobibi\.art\/social\/gobibi-keyvisual-v\d+\.jpg$/);
  assert.equal(brandSocialMetadata.openGraph.title, SITE_TITLE);
  assert.equal(brandSocialMetadata.openGraph.locale, 'ko_KR');
  assert.doesNotMatch(SHARE_IMAGE.url, /exhibition|planet-friends/);
});
test('Twitter uses the same visual and a large-image card', () => {
  assert.equal(brandSocialMetadata.twitter.card, 'summary_large_image');
  assert.deepEqual(brandSocialMetadata.twitter.images, [{ url: SHARE_IMAGE.url, alt: SHARE_IMAGE.alt }]);
});
test('root layout applies sharing metadata without forcing a page canonical URL', () => {
  const layout = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');
  assert.match(layout, /import \{ brandSocialMetadata \} from "@\/lib\/site-metadata"/);
  assert.match(layout, /export const metadata: Metadata = \{\s*\.\.\.brandSocialMetadata,/);
  assert.equal('alternates' in brandSocialMetadata, false);
  assert.equal('url' in brandSocialMetadata.openGraph, false);
});
test('share asset is a compact real 1200 by 630 JPEG', () => {
  const image = readFileSync(join(root, 'public', new URL(SHARE_IMAGE.url).pathname));
  assert.equal(image.readUInt16BE(0), 0xffd8);
  assert.ok(image.length < 1024 * 1024, 'keep messenger download small');
  let offset = 2;
  while (offset < image.length) {
    assert.equal(image[offset], 0xff);
    const marker = image[offset + 1];
    const length = image.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      assert.equal(image.readUInt16BE(offset + 5), SHARE_IMAGE.height);
      assert.equal(image.readUInt16BE(offset + 7), SHARE_IMAGE.width);
      return;
    }
    offset += length + 2;
  }
  assert.fail('JPEG frame dimensions were not found');
});
test('subpages inherit the brand image without a conflicting cover override', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  }
  for (const file of walk(join(root, 'src/app'))) {
    assert.doesNotMatch(file, /(?:opengraph-image|twitter-image)\./);
    if (/\.(tsx?|jsx?)$/.test(file)) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /\b(?:openGraph|twitter)\s*:/, file);
    }
  }
});
