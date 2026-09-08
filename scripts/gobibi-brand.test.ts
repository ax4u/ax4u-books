import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const root = process.cwd();
const name = 'SANG#MUNG';
const pages = [
  'src/app/page.tsx',
  'src/app/components/gobibi/BrandNavigation.tsx',
  'src/app/components/gobibi/GobibiFooter.tsx',
  'src/app/exhibition/page.tsx',
  'src/app/login/page.tsx',
];
test('all existing brand placements use the exact canonical English spelling', () => {
  for (const file of pages) assert.ok(readFileSync(join(root, file), 'utf8').includes(name), file);
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
  }
  for (const file of walk(join(root, 'src/app')).filter(f => f.endsWith('.tsx'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /SANGMUNG/, file);
  }
});
test('the homepage font includes the hash glyph, without fallback mixing', () => {
  const home = readFileSync(join(root, pages[0]), 'utf8');
  assert.match(home, /BagelFatOne-korean\.ttf/);
  const fontkit = createRequire(import.meta.url)('@pdf-lib/fontkit');
  const font = fontkit.create(readFileSync(join(root, 'public/fonts/gobibi/BagelFatOne-korean.ttf')));
  for (const character of name) assert.ok(font.hasGlyphForCodePoint(character.codePointAt(0)), character);
});
test('display spelling does not change existing anchors or asset URLs', () => {
  const home = readFileSync(join(root, pages[0]), 'utf8');
  assert.match(home, /id="sangmung"/);
  assert.match(home, /\/home\/gobibi\/sangmung\.webp/);
  assert.doesNotMatch(home, /(?:href|src|id)="[^"]*SANG#MUNG/);
});
