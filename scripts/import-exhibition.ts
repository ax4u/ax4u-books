import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { exhibitionCatalogSchema } from '../src/lib/exhibition/schema';

async function main() {
  const manifestPath = resolve(process.argv[2] || '../source-manifest.json');
  const approvalPath = resolve(process.argv[3] || '../ready-to-publish.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8'));
  assert.equal(approval.approved, true);
  assert.equal(approval.approvalMessageId, '1548996855206252597');
  assert.equal(manifest.approvalMessageId, approval.approvalMessageId);
  assert.equal(resolve(approval.manifest), manifestPath);
  assert.equal(manifest.books.length, 3);
  const books = [];
  // Validate all inputs before writing any public file. No PDF rewriting or artwork generation.
  for (const book of manifest.books) {
    assert.match(book.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.notEqual(book.slug, 'planet-friends');
    const grant = approval.books.find((item: { slug: string }) => item.slug === book.slug);
    assert.equal(grant?.title, book.title);
    assert.equal(grant?.pages, book.pageCount);
    assert.equal(book.layout, 'single-pages-cover-then-body');
    const data = readFileSync(book.pdf);
    assert.equal(data.length, book.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), book.sha256);
    const info = execFileSync('pdfinfo', [book.pdf], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
    assert.equal(Number(info.match(/^Pages:\s+(\d+)/m)?.[1]), book.pageCount);
    assert.equal(book.bodyPages + 1, book.pageCount);
    const prefix = `/published-exhibition/${book.slug}`;
    const pages = Array.from({ length: book.pageCount }, (_, index) => ({ src: `${prefix}/page-${String(index).padStart(3, '0')}.webp`, width: 1, height: 1, label: index === 0 ? '앞표지' : `본문 ${index}쪽` }));
    // The full reader is the publication. PDF download is optional to fit Hobby's source upload limit.
    books.push({ slug: book.slug, title: book.title, author: book.author, description: book.description, cover: pages[0], ...(process.argv.includes('--include-reading-pdf') ? { readingPdf: `${prefix}/reading.pdf` } : {}), pages });
  }
  exhibitionCatalogSchema.parse(books);
  const scratch = mkdtempSync(join(tmpdir(), 'gobibi-render-'));
  try {
    for (const [index, book] of books.entries()) {
      mkdirSync(`public/published-exhibition/${book.slug}`, { recursive: true });
      for (const [pageIndex, page] of book.pages.entries()) {
        const png = join(scratch, 'page');
        execFileSync('pdftoppm', ['-f', String(pageIndex + 1), '-l', String(pageIndex + 1), '-singlefile', '-scale-to', '1800', '-png', manifest.books[index].pdf, png], { stdio: 'pipe' });
        const result = await sharp(png + '.png').webp({ quality: 92, effort: 6, smartSubsample: true }).toFile('public' + page.src);
        page.width = result.width; page.height = result.height;
      }
      if (book.readingPdf) copyFileSync(manifest.books[index].pdf, 'public' + book.readingPdf);
      console.log(`Rendered original PDF: ${book.slug}, ${book.pages.length} pages`);
    }
    const catalog = exhibitionCatalogSchema.parse(books);
    writeFileSync('src/lib/exhibition/public-books.json', JSON.stringify(catalog, null, 2) + '\n');
    console.log('Public catalog contains only approved display metadata, page manifests and reading PDF links.');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
