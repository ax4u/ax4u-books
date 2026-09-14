import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { publishedBooks, getPublishedBook } from '../src/lib/exhibition/catalog';
import { proxy, config } from '../src/proxy';

test('withdrawn works are absent from the catalog and cannot be resolved', () => {
  assert.ok(publishedBooks.length === 0 || publishedBooks.length === 3);
  for (const slug of ['planet-friends', 'private-book', '__proto__', '']) {
    assert.equal(getPublishedBook(slug), undefined);
  }
});

test('all original assets are preserved and excluded from deployment', () => {
  const pages = JSON.parse(readFileSync('src/lib/exhibition/pages.json', 'utf8'));
  assert.equal(pages.length, 29);
  for (const page of pages) {
    const data = readFileSync(`public${page.src}`);
    assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16), page.width);
    assert.equal(data.readUInt32BE(20), page.height);
  }
  assert.match(readFileSync('.vercelignore', 'utf8'), /^public\/exhibition\/\*\*/m);
});

test('proxy blocks reader, API, originals and optimized images before auth', async () => {
  const paths = [
    '/exhibition/planet-friends', '/exhibition/planet-friends?x=1',
    '/exhibition/planet-friends/reader', '/exhibition/planet-friends/cover.png',
    '/exhibition/planet-friends/page-28.png', '/exhibition/%70lanet-friends/cover.png',
    '/api/exhibition/planet-friends', '/api/books/planet-friends/pdf', '/books/planet-friends',
    '/_next/image?url=%2Fexhibition%2Fplanet-friends%2Fcover.png&w=640&q=75',
    '/_next/image?url=https%3A%2F%2Fgobibi.art%2Fexhibition%2Fplanet-friends%2Fcover.png&w=640&q=75',
  ];
  for (const path of paths) {
    const url = `https://gobibi.art${path}`;
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, path);
    const response = await proxy(new NextRequest(url));
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('cache-control'), 'private, no-store', path);
  }
});

test('unrelated optimized images bypass auth as before', async () => {
  const response = await proxy(new NextRequest('https://gobibi.art/_next/image?url=%2Fhome%2Fgobibi%2Fsangmung.webp&w=640&q=75'));
  assert.equal(response.headers.get('x-middleware-next'), '1');
});
