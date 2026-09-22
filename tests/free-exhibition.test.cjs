/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression harness. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./backend-loader.cjs');
const deny = () => { throw new Error('Unexpected auth, DB, request body, or provider access'); };
const external = {
  '@/lib/env': { env: { polarWebhookSecret: 'offline-test', cronSecret: 'offline-test' }, isPolarConfigured: true, resolveAiProvider: deny },
  '@/lib/auth': { getSessionUser: deny },
  '@/lib/books/store': { createBook: deny, getBook: deny, getBookByCheckoutId: deny, updateBook: deny, deleteBook: deny },
  '@/lib/books/assets': { deleteBookAssets: deny },
  '@/lib/jobs/generation': { enqueueGenerationJob: deny, processGenerationJobs: deny },
  '@/lib/polar/checkout': { createBookCheckout: deny },
  '@polar-sh/sdk/webhooks': { validateEvent: deny },
  'next/server': { after: deny },
  'next/navigation': { redirect: deny },
};
const trap = new Proxy({}, { get: deny });
for (const [file, method] of [
  ['api/jobs/generate', 'GET'], ['api/mock-pay', 'GET'], ['api/webhooks/polar', 'POST'],
  ['api/books/[id]/generate', 'POST'], ['api/books/[id]/pages/[index]/regenerate', 'POST'],
  ['api/books/[id]', 'PATCH'], ['api/books/[id]', 'DELETE'],
]) test(`${method} ${file} rejects before request/auth/DB/provider access`, async () => {
  const response = await load(`src/app/${file}/route.ts`, external, { NODE_ENV: 'production' })[method](trap, trap);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'FREE_EXHIBITION_ONLY');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('server action cannot create books or checkout, including crafted direct calls', async () => {
  const { createBookAction } = load('src/app/books/actions.ts', external);
  assert.match((await createBookAction({}, trap)).error, /비상업 무료 전시/);
});
test('checkout service independently rejects without constructing Polar client', async () => {
  const { createBookCheckout } = load('src/lib/polar/checkout.ts', { ...external, './client': { getPolarClient: deny } });
  await assert.rejects(createBookCheckout(trap, trap), /비상업 무료 전시/);
});
for (const method of ['products', 'quote', 'status', 'orders']) test(`printing ${method} never authenticates or contacts provider`, async () => {
  const { printingHandlers } = load('src/lib/printing/handlers.ts');
  const response = await printingHandlers(trap)[method](trap);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'FREE_EXHIBITION_ONLY');
});
for (const cached of [true, false]) test(`existing owned PDF download preserved; cached=${cached}, no persistence`, async () => {
  const book = { id: 'offline-book', userId: 'offline-user', status: 'completed', title: 'Test', pdfPath: cached ? 'stored' : null };
  const bytes = Buffer.from('offline-pdf-fixture');
  const { GET } = load('src/app/api/books/[id]/pdf/route.ts', { ...external,
    '@/lib/auth': { getSessionUser: async () => ({ id: 'offline-user' }) },
    '@/lib/books/store': { getBook: async () => book, updateBook: deny },
    '@/lib/books/assets': { readStoredAsset: async () => ({ bytes }), storeBookPdf: deny, bufferToArrayBuffer: b => Uint8Array.from(b).buffer },
    '@/lib/pdf/generate': { generateBookPdf: async () => bytes },
  });
  const response = await GET(trap, { params: Promise.resolve({ id: book.id }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(await response.text(), bytes.toString());
});
for (const user of [null, { id: 'other-user' }]) test(`PDF ownership retained: ${JSON.stringify(user)}`, async () => {
  const { GET } = load('src/app/api/books/[id]/pdf/route.ts', { ...external,
    '@/lib/auth': { getSessionUser: async () => user },
    '@/lib/books/store': { getBook: async () => ({ id: 'b1', userId: 'owner' }) },
    '@/lib/pdf/generate': { generateBookPdf: deny },
  });
  assert.equal((await GET(trap, { params: Promise.resolve({ id: 'b1' }) })).status, user ? 404 : 401);
});
test('free feedback downloads without inventing purchase intent', () => {
  const { createFeedbackPayload } = load('src/app/my-whale/whale-state.ts');
  const payload = createFeedbackPayload({ returnIntent: 'yes', reason: '좋아요' }, null);
  assert.equal(payload.returnIntent, 'yes');
  assert.equal(Object.hasOwn(payload, 'purchaseIntent'), false);
});
test('legacy cover/page reads never migrate stored records during exhibition', async () => {
  const { persistInlinePageImage } = load('src/lib/books/legacy.ts', {
    '@/lib/books/store': { markBookPageImageStored: deny },
    './assets': { storePageImage: deny },
  });
  const page = { get image() { return deny(); } };
  assert.equal(await persistInlinePageImage(trap, page), page);
});
