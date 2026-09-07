import test from 'node:test';
import assert from 'node:assert/strict';
import { SweetbookClient } from '../src/lib/printing/client';

const config = { enabled: true, environment: 'sandbox' as const, apiKey: 'fixture-not-a-real-key' };
test('quote sends items only and validates numeric provider quote', async () => {
  const client = new SweetbookClient(config, async (url, init) => {
    assert.equal(url, 'https://api-sandbox.sweetbook.com/v1/orders/estimate');
    assert.deepEqual(JSON.parse(init!.body as string), { items: [{ bookUid: 'bk_fixture', quantity: 2 }] });
    return Response.json({ success: true, data: { paidCreditAmount: 11000, creditBalance: 22000, creditSufficient: true } });
  });
  assert.equal((await client.quote({ items: [{ bookUid: 'bk_fixture', quantity: 2 }] })).paidCreditAmount, 11000);
  await assert.rejects(() => client.quote({ items: [{ bookUid: 'bk_fixture', quantity: 201 }] }));
  await assert.rejects(() => client.quote({ items: [{ bookUid: 'bk_fixture', quantity: 1 }], shipping: {} }));
});
test('status projects only safe fields, product path rejects traversal', async () => {
  const client = new SweetbookClient(config, async () => Response.json({ success: true, data: { orderUid: 'or_fixture', orderStatus: 'PAID', orderStatusDisplay: '결제완료', recipientName: 'SYNTHETIC_DO_NOT_RETURN', address1: 'FIXTURE' } }));
  assert.deepEqual(await client.status('or_fixture'), { orderUid: 'or_fixture', orderStatus: 'PAID', orderStatusDisplay: '결제완료' });
  await assert.rejects(() => client.product('../credits'));
  await assert.rejects(() => client.status('https://evil.test'));
});
test('disabled config, invalid envelope, numeric status, provider errors fail closed', async () => {
  assert.throws(() => new SweetbookClient({ ...config, enabled: false }));
  assert.throws(() => new SweetbookClient({ ...config, apiKey: '' }));
  for (const data of [{ success: false, errors: ['SENSITIVE'] }, { success: true, data: { orderUid: 'or_fixture', orderStatus: 20 } }, null]) {
    await assert.rejects(() => new SweetbookClient(config, async () => Response.json(data)).status('or_fixture'), /PRINT_PROVIDER_/);
  }
  await assert.rejects(() => new SweetbookClient(config, async () => { throw new Error('secret'); }).products(), /PRINT_PROVIDER_UNAVAILABLE/);
});

// SYNTHETIC CONTRACT FIXTURES, NOT LIVE PRICES OR PROVIDER RESULTS.
const spec = { bookSpecUid: 'FIXTURE_SC', name: 'fixture only', pageMin: 24, pageMax: 130, pageIncrement: 2, booksPerBox: 20 };
test('product list uses fixed sandbox endpoint, Bearer auth and flattened data', async () => {
  const client = new SweetbookClient({ enabled: true, environment: 'sandbox', apiKey: 'fixture-not-a-real-key' }, async (url, init) => {
    assert.equal(url, 'https://api-sandbox.sweetbook.com/v1/book-specs');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-not-a-real-key');
    assert.equal(init?.redirect, 'error');
    return Response.json({ success: true, message: 'fixture', data: [spec] });
  });
  assert.deepEqual(await client.products(), [spec]);
});
