/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./backend-loader.cjs');
const offlineEnv = { env: { appUrl: 'http://localhost:3000' }, isSupabaseConfigured: false, isPolarConfigured: false };
const next = { NextResponse: { redirect: (url) => Response.redirect(url, 307) }, after: () => {} };
const forbidden = () => { throw new Error('Unexpected external/state-changing call'); };

for (const runtime of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
  test(`mock authentication is disabled on deployed runtime ${JSON.stringify(runtime)}`, async () => {
    let writes = 0;
    const auth = load('src/lib/auth.ts', {
      '@/lib/env': offlineEnv,
      '@/lib/supabase/server': { createSupabaseServerClient: forbidden },
      'next/headers': { cookies: async () => ({ get: () => ({ value: 'victim@example.test' }), set: () => writes++ }) },
    }, runtime);
    assert.equal(await auth.getSessionUser(), null);
    await assert.rejects(auth.mockSignIn('victim@example.test'));
    assert.equal(writes, 0);
  });
  test(`mock payment cannot bypass payment on deployed runtime ${JSON.stringify(runtime)}`, async () => {
    const route = load('src/app/api/mock-pay/route.ts', {
      '@/lib/env': offlineEnv, 'next/server': next,
      '@/lib/auth': { getSessionUser: async () => null },
      '@/lib/books/store': {}, '@/lib/jobs/generation': {},
    }, runtime);
    assert.equal((await route.GET(new Request('http://localhost:3000/api/mock-pay?bookId=x'))).status, 404);
  });
  test(`cron requires a secret on deployed runtime ${JSON.stringify(runtime)}`, async () => {
    let calls = 0;
    const route = load('src/app/api/jobs/generate/route.ts', {
      '@/lib/env': offlineEnv,
      '@/lib/jobs/generation': { processGenerationJobs: async () => { calls++; return {}; } },
    }, runtime);
    assert.equal((await route.GET(new Request('http://localhost:3000/api/jobs/generate'))).status, 401);
    assert.equal(calls, 0);
  });
  test(`checkout does not silently fall back to mock on deployed runtime ${JSON.stringify(runtime)}`, async () => {
    const checkout = load('src/lib/polar/checkout.ts', {
      '@/lib/env': offlineEnv,
      './client': { getPolarClient: () => null },
      '@/lib/books/store': { updateBook: forbidden },
    }, runtime);
    await assert.rejects(checkout.createBookCheckout({ id: 'book' }, { id: 'owner' }));
  });
}

function webhookHarness(book, event, enqueue = async () => {}) {
  const writes = [], jobs = [];
  const route = load('src/app/api/webhooks/polar/route.ts', {
    '@/lib/env': { env: { polarWebhookSecret: 'offline-test', polarProductId: 'product' }, isPolarConfigured: true },
    'next/server': next,
    '@polar-sh/sdk/webhooks': { validateEvent: () => event, WebhookVerificationError: class extends Error {} },
    '@/lib/books/store': {
      getBook: async () => book,
      getBookByCheckoutId: async (id) => book.checkoutId === id ? book : null,
      updateBook: async (_id, patch) => { writes.push(patch); Object.assign(book, patch); },
    },
    '@/lib/jobs/generation': { enqueueGenerationJob: async (job) => { jobs.push(job); return enqueue(job); }, processGenerationJobs: forbidden },
  });
  return { post: () => route.POST(new Request('http://localhost/api/webhooks/polar', { method: 'POST', body: '{}' })), writes, jobs };
}
const paidEvent = (overrides = {}) => ({ type: 'order.paid', data: { checkoutId: 'checkout', productId: 'product', metadata: { bookId: 'book', userId: 'owner' }, ...overrides } });
for (const [label, event] of [
  ['unrelated checkout', paidEvent({ checkoutId: 'other-checkout' })],
  ['wrong owner metadata', paidEvent({ metadata: { bookId: 'book', userId: 'other' } })],
  ['different product', paidEvent({ productId: 'other-product' })],
  ['no checkout', paidEvent({ checkoutId: null })],
]) {
  test(`webhook rejects ${label} without granting a book`, async () => {
    const h = webhookHarness({ id: 'book', userId: 'owner', status: 'draft', checkoutId: 'checkout' }, event);
    const response = await h.post();
    assert.equal(response.status, 200); // ignore irrelevant signed events, do not retry forever
    assert.equal(h.writes.length, 0);
    assert.equal(h.jobs.length, 0);
  });
}
test('webhook redelivery repairs paid state after enqueue failed', async () => {
  let attempts = 0;
  const book = { id: 'book', userId: 'owner', status: 'draft', checkoutId: 'checkout' };
  const h = webhookHarness(book, paidEvent(), async () => { if (++attempts === 1) throw new Error('temporary queue failure'); });
  await assert.rejects(h.post(), /temporary queue failure/);
  assert.equal(book.status, 'paid');
  assert.equal((await h.post()).status, 200);
  assert.equal(attempts, 2);
});

// Minimal in-memory PostgREST model: evaluate conditional updates atomically,
// while concurrent readers see the same snapshot. No Supabase connection.
function jobDatabase(initial) {
  let row = { ...initial };
  return {
    from() {
      let patch, filters = [], limit = Infinity;
      const q = {
        select() { return q; }, update(value) { patch = value; return q; },
        eq(key, value) { filters.push(r => r[key] === value); return q; },
        lt(key, value) { filters.push(r => r[key] < value); return q; },
        lte(key, value) { filters.push(r => r[key] <= value); return q; },
        order() { return q; }, limit(value) { limit = value; return q; },
        maybeSingle() { return q.single(); },
        single() { const result = execute(); return Promise.resolve({ data: result.data[0] ?? null, error: null }); },
        then(resolve) { return Promise.resolve(execute()).then(resolve); },
      };
      function execute() {
        const match = limit > 0 && filters.every(f => f(row));
        if (match && patch) row = { ...row, ...patch };
        return { data: match ? [{ ...row }] : [], error: null };
      }
      return q;
    },
  };
}
for (const status of ['pending', 'running']) {
  test(`concurrent workers claim a ${status} job only once`, async () => {
    const db = jobDatabase({ id: 'job', book_id: 'book', user_id: 'owner', type: 'book', page_index: null,
      status, attempts: 0, max_attempts: 5, next_run_at: '2000-01-01', locked_at: status === 'running' ? '2000-01-01' : null,
      last_error: null, created_at: '2000-01-01', updated_at: '2000-01-01' });
    let generations = 0;
    const jobs = load('src/lib/jobs/generation.ts', {
      '@/lib/env': { isSupabaseConfigured: true, isSupabaseAdminConfigured: true },
      '@/lib/supabase/admin': { createSupabaseAdminClient: () => db },
      '@/lib/ai/storybook': { runGeneration: async () => { generations++; }, runPageRegeneration: forbidden },
      '@/lib/books/store': { updateBook: forbidden },
    });
    const results = await Promise.all([jobs.processGenerationJobs({ limit: 1 }), jobs.processGenerationJobs({ limit: 1 })]);
    assert.equal(generations, 1);
    assert.equal(results.reduce((sum, r) => sum + r.claimed, 0), 1);
  });
}

for (const nextPath of ['@evil.example', '//evil.example', '/\\evil.example', 'https://evil.example']) {
  test(`auth callback confines next=${nextPath} to app origin`, async () => {
    const route = load('src/app/auth/callback/route.ts', {
      '@/lib/env': offlineEnv, 'next/server': next,
      '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }) },
    });
    const response = await route.GET(new Request('http://localhost:3000/auth/callback?code=test&next=' + encodeURIComponent(nextPath)));
    const target = new URL(response.headers.get('location'));
    assert.equal(target.origin, 'http://localhost:3000');
    assert.equal(target.pathname, '/dashboard');
  });
}
test('auth callback without code reports invalid link instead of success', async () => {
  const route = load('src/app/auth/callback/route.ts', { '@/lib/env': offlineEnv, 'next/server': next, '@/lib/supabase/server': {} });
  const response = await route.GET(new Request('http://localhost:3000/auth/callback'));
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
});

test('email confirmation confines next to app origin', async () => {
  const route = load('src/app/auth/confirm/route.ts', {
    '@/lib/env': offlineEnv, 'next/server': next,
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { verifyOtp: async () => ({ error: null }) } }) },
  });
  const response = await route.GET(new Request('http://localhost:3000/auth/confirm?token_hash=test&type=signup&next=%40evil.example'));
  assert.equal(new URL(response.headers.get('location')).origin, 'http://localhost:3000');
});

const sampleBook = () => ({ id: 'book', userId: 'owner', status: 'completed', title: '한글 제목', topic: 'test', options: { pageCount: 1 }, pages: [{ index: 0, text: 'text', image: 'data:image/png;base64,AQID' }], pdfPath: null });
function bookRoute(entry, book, user = { id: 'owner' }, extra = {}) {
  return load(entry, {
    '@/lib/auth': { getSessionUser: async () => user },
    '@/lib/books/store': { getBook: async () => book, updateBook: async () => book },
    '@/lib/books/assets': { bufferToArrayBuffer: bytes => Uint8Array.from(bytes).buffer, dataUrlToBuffer: () => ({ bytes: Buffer.from([1,2,3]), mimeType: 'image/png' }), readStoredAsset: async () => null, storeBookPdf: async () => null },
    '@/lib/books/legacy': { persistInlinePageImage: async () => {} },
    '@/lib/pdf/generate': { generateBookPdf: async () => Buffer.from('%PDF-offline-fixture') },
    '@/lib/jobs/generation': {}, 'next/server': next,
    ...extra,
  });
}
const params = { params: Promise.resolve({ id: 'book', index: '0' }) };
for (const endpoint of ['pdf', 'cover', 'assets/[index]', 'status', 'generate', 'pages/[index]/regenerate', '']) {
  for (const user of [null, { id: 'someone-else' }]) {
    test(`${endpoint || 'book PATCH'} denies ${user ? 'another owner' : 'anonymous'} access`, async () => {
      const route = bookRoute(`src/app/api/books/[id]/${endpoint ? endpoint + '/' : ''}route.ts`, sampleBook(), user);
      const method = route.GET || route.POST || route.PATCH;
      const response = await method(new Request('http://localhost/test'), params);
      assert.equal(response.status, user ? 404 : 401);
    });
  }
}
for (const endpoint of ['pdf', 'cover', 'assets/[index]']) {
  test(`${endpoint} does not cache mutable private content across edits/signout`, async () => {
    const route = bookRoute(`src/app/api/books/[id]/${endpoint}/route.ts`, sampleBook());
    const response = await route.GET(new Request('http://localhost/test'), params);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    if (endpoint === 'pdf') assert.match(response.headers.get('content-disposition'), /UTF-8''%/);
  });
}
test('PDF regenerates when cached object is unavailable', async () => {
  const route = bookRoute('src/app/api/books/[id]/pdf/route.ts', { ...sampleBook(), pdfPath: 'missing.pdf' }, undefined, {
    '@/lib/books/assets': { bufferToArrayBuffer: bytes => Uint8Array.from(bytes).buffer, readStoredAsset: async () => { throw new Error('Object not found'); }, storeBookPdf: async () => null },
  });
  assert.equal((await route.GET(new Request('http://localhost/test'), params)).status, 200);
});
