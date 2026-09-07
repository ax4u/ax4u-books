import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareOrder, orderPayloadSchema, assertTrustedPdfUrl, validatePageCount } from '../src/lib/printing/safety';
import { printingHandlers } from '../src/lib/printing/handlers';
import { providerConfig } from '../src/lib/printing/server';
import { SweetbookClient } from '../src/lib/printing/client';

test('server configuration defaults disabled sandbox and rejects malformed environment', () => {
  assert.deepEqual(providerConfig({}), { enabled: false, environment: 'sandbox', apiKey: '' });
  assert.equal(providerConfig({ PRINTING_ENABLED: 'TRUE' }).enabled, false);
  assert.throws(() => providerConfig({ SWEETBOOK_ENV: 'https://evil.test' }));
});
test('owned HTTP quote and status exercise real adapter with synthetic transport; suppress partner balance and PII', async () => {
  const binding = { userId: 'user_fixture', bookId: 'local_fixture', providerBookUid: 'bk_fixture', bookSpecUid: 'SPEC_FIXTURE', pageCount: 24, finalized: true, orderUid: 'or_fixture' };
  const client = new SweetbookClient({ enabled: true, environment: 'sandbox', apiKey: 'fixture' }, async (url) => {
    const data = String(url).includes('book-specs') ? { bookSpecUid: 'SPEC_FIXTURE', name: 'FIXTURE', pageMin: 24, pageMax: 130, pageIncrement: 2, booksPerBox: 20 }
      : String(url).endsWith('/estimate') ? { paidCreditAmount: 11000, creditBalance: 22000, creditSufficient: true }
      : { orderUid: 'or_fixture', orderStatus: 'PAID', recipientName: 'SYNTHETIC SECRET' };
    return Response.json({ success: true, data });
  });
  const deps = { authenticate: async () => ({ id: 'user_fixture' }), origin: 'https://books.example.com', client: () => client, binding: async () => binding };
  const request = () => new Request('https://books.example.com/api/printing/quote', { method: 'POST', headers: { Origin: deps.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'local_fixture', quantity: 1 }) });
  const response = await printingHandlers(deps).quote(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await response.json()).data, { paidCreditAmount: 11000, currency: 'KRW', kind: 'provider_estimate', checkoutEnabled: false });
  const status = await printingHandlers(deps).status(new Request('https://books.example.com/api/printing/status?bookId=local_fixture'));
  assert.deepEqual((await status.json()).data, { orderUid: 'or_fixture', orderStatus: 'PAID' });
  assert.equal((await printingHandlers({ ...deps, binding: async () => ({ ...binding, userId: 'other' }) }).quote(request())).status, 404);
  assert.equal((await printingHandlers({ ...deps, binding: async () => ({ ...binding, finalized: false }) }).quote(request())).status, 409);
});

// All identities, amounts and shipping values below are synthetic test fixtures.
const payload = { items: [{ bookUid: 'bk_fixture', quantity: 1 }], shipping: { recipientName: 'TEST ONLY', recipientPhone: '000-0000-0000', postalCode: '00000', address1: 'NOT A REAL ADDRESS' } };
test('order schema follows documented fields, rejects extra PII and invalid quantities', () => {
  assert.deepEqual(orderPayloadSchema.parse(payload), payload);
  for (const bad of [{ ...payload, paid: true }, { ...payload, shipping: { ...payload.shipping, email: 'test@example.invalid' } }, { ...payload, items: [{ bookUid: 'bk_fixture', quantity: 0 }] }]) assert.equal(orderPayloadSchema.safeParse(bad).success, false);
});
test('order preparation requires separate paid physical entitlement and explicit approval; never submits', () => {
  const config = { enabled: true, environment: 'sandbox' as const, apiKey: 'fixture' };
  assert.throws(() => prepareOrder(config, payload, null), /PRINT_PAID_APPROVAL_REQUIRED/);
  const authorization = { intentId: 'intent_fixture', userId: 'user_fixture', kind: 'physical_book' as const, paymentStatus: 'confirmed' as const, approved: true, environment: 'sandbox' as const, payload, expiresAt: Date.now() + 60_000 };
  const a = prepareOrder(config, payload, authorization);
  assert.equal(a.method, 'POST');
  assert.equal(a.path, '/orders');
  assert.equal(a.idempotencyKey, prepareOrder(config, payload, authorization).idempotencyKey);
  assert.equal(a.dispatchEnabled, false);
  assert.throws(() => prepareOrder(config, { ...payload, items: [{ bookUid: 'bk_fixture', quantity: 2 }] }, authorization), /PRINT_APPROVAL_MISMATCH/);
  assert.throws(() => prepareOrder(config, payload, { ...authorization, approved: false }), /PRINT_PAID_APPROVAL_REQUIRED/);
  assert.throws(() => prepareOrder(config, payload, { ...authorization, expiresAt: 0 }), /PRINT_PAID_APPROVAL_REQUIRED/);
  assert.throws(() => prepareOrder({ ...config, enabled: false }, payload, authorization), /PRINT_PROVIDER_DISABLED/);
});
test('PDF URL policy rejects arbitrary URLs, credentials, redirects paths, IPs and private DNS; never downloads', async () => {
  const origins = ['https://print-assets.example.com'];
  const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
  await assertTrustedPdfUrl('https://print-assets.example.com/print/cover.pdf?token=fixture', origins, publicDns);
  for (const url of ['http://print-assets.example.com/print/a.pdf', 'https://evil.test/print/a.pdf', 'https://user:pass@print-assets.example.com/print/a.pdf', 'https://127.0.0.1/print/a.pdf', 'https://print-assets.example.com/redirect?url=x', 'https://print-assets.example.com/print/a.pdf#x']) await assert.rejects(() => assertTrustedPdfUrl(url, origins, publicDns));
  await assert.rejects(() => assertTrustedPdfUrl('https://print-assets.example.com/print/a.pdf', origins, async () => [{ address: '169.254.169.254', family: 4 }]));
  assert.throws(() => validatePageCount(25, { pageMin: 24, pageMax: 130, pageIncrement: 2 }));
  validatePageCount(26, { pageMin: 24, pageMax: 130, pageIncrement: 2 });
});
test('HTTP gates reject unauthenticated, cross-origin, unknown ownership and all order placement', async () => {
  let calls = 0;
  const deps = { authenticate: async () => ({ id: 'user_fixture' }), origin: 'https://books.example.com', client: () => { calls++; throw new Error('must not reach'); }, binding: async () => null };
  const req = (path: string, origin = deps.origin) => new Request(`https://books.example.com/api/printing/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'local_fixture', quantity: 1, paid: true }) });
  assert.equal((await printingHandlers({ ...deps, authenticate: async () => null }).products(new Request('https://books.example.com/api/printing/products'))).status, 401);
  assert.equal((await printingHandlers(deps).quote(req('quote', 'https://evil.test'))).status, 403);
  assert.equal((await printingHandlers(deps).orders(req('orders'))).status, 503);
  const quote = new Request('https://books.example.com/api/printing/quote', { method: 'POST', headers: { Origin: deps.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'local_fixture', quantity: 1 }) });
  assert.equal((await printingHandlers(deps).quote(quote)).status, 503);
  assert.equal(calls, 0);
});
