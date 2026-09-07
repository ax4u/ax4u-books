/* eslint-disable @typescript-eslint/no-require-imports -- Offline Node CJS test harness. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./backend-loader.cjs');

function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ topic: '달나라 모험', style: 'watercolor', pageCount: '4', ageGroup: 'child', language: 'ko', ...extra })) data.set(key, value);
  return data;
}
function setup({ runtime = { NODE_ENV: 'production' }, provider = 'openai', payment = true, webhook = 'offline-webhook', failure, user = { id: 'u1', email: 'test@example.invalid' } } = {}) {
  const calls = [];
  const redirectError = new Error('NEXT_REDIRECT');
  const action = load('src/app/books/actions.ts', {
    '@/lib/env': { resolveAiProvider: () => provider, isPolarConfigured: payment, env: { polarWebhookSecret: webhook } },
    '@/lib/auth': { getSessionUser: async () => { if (failure === 'auth') throw new Error('SECRET auth'); return user; } },
    '@/lib/books/store': { createBook: async (input) => { calls.push(['book', input]); if (failure === 'book') throw new Error('SECRET database'); return { id: 'b1', ...input }; } },
    '@/lib/polar/checkout': { createBookCheckout: async () => { calls.push(['checkout']); if (failure === 'checkout') throw new Error('SECRET payment upstream'); return { url: 'https://checkout.example.invalid/b1' }; } },
    'next/navigation': { redirect: (url) => { calls.push(['redirect', url]); throw redirectError; } },
  }, runtime).createBookAction;
  return { action, calls, redirectError };
}
for (const config of [
  { provider: 'mock' },
  { payment: false },
  { webhook: undefined, payment: false },
  { webhook: '' },
  { provider: 'mock', runtime: { VERCEL_ENV: 'preview' } },
  { provider: 'mock', runtime: { NODE_ENV: 'development' } },
]) {
  test(`not ready checkout ${JSON.stringify(config)} returns friendly error before any writes`, async () => {
    const { action, calls } = setup(config);
    const state = await action({}, form());
    assert.match(state.error, /준비.*잠시 후/);
    assert.deepEqual(calls, []);
  });
}
for (const failure of ['book', 'checkout', 'auth']) {
  test(`${failure} rejection becomes sanitized action state`, async () => {
    const { action, calls } = setup({ failure });
    const state = await action({}, form());
    assert.match(state.error, /다시 시도/);
    assert.doesNotMatch(state.error, /SECRET|database|upstream/);
    assert.equal(calls.some(([name]) => name === 'redirect'), false);
  });
}
test('successful checkout redirect is outside catch', async () => {
  const { action, calls, redirectError } = setup();
  await assert.rejects(action({}, form()), (error) => error === redirectError);
  assert.deepEqual(calls.map(([name]) => name), ['book', 'checkout', 'redirect']);
  assert.equal(calls[2][1], 'https://checkout.example.invalid/b1');
});
test('unauthenticated redirect is preserved', async () => {
  const { action, calls, redirectError } = setup({ user: null });
  await assert.rejects(action({}, form()), (error) => error === redirectError);
  assert.deepEqual(calls, [['redirect', '/login']]);
});
test('local no-key no-payment demo still reaches mock checkout', async () => {
  const { action, calls, redirectError } = setup({ runtime: { NODE_ENV: 'development' }, provider: 'mock', payment: false });
  await assert.rejects(action({}, form()), (error) => error === redirectError);
  assert.equal(calls[0][0], 'book');
});
test('invalid topic creates nothing', async () => {
  const { action, calls } = setup();
  assert.ok((await action({}, form({ topic: 'x' }))).error);
  assert.deepEqual(calls, []);
});

test('optional character draft is appended explicitly to generation topic', async () => {
  const { action, calls, redirectError } = setup();
  await assert.rejects(action({}, form({ characterName: '  별이  ', characterTraits: '  파란 모자를 쓴 용감한 토끼  ' })), (error) => error === redirectError);
  assert.equal(calls[0][1].topic, '달나라 모험\n\n주인공 설정: 이름: 별이; 특징: 파란 모자를 쓴 용감한 토끼');
});
test('missing or blank character fields preserve the original topic', async () => {
  for (const extra of [{}, { characterName: ' ', characterTraits: '' }]) {
    const { action, calls, redirectError } = setup();
    await assert.rejects(action({}, form(extra)), (error) => error === redirectError);
    assert.equal(calls[0][1].topic, '달나라 모험');
  }
});
for (const extra of [{ characterName: 'a'.repeat(41) }, { characterTraits: 'a'.repeat(121) }, { characterName: new Blob(['file']) }]) {
  test(`invalid character input ${Object.keys(extra)[0]} is rejected before creation`, async () => {
    const { action, calls } = setup();
    assert.ok((await action({}, form(extra))).error);
    assert.deepEqual(calls, []);
  });
}
test('maximum bounded topic and character draft fit the assembled topic limit', async () => {
  const { action, calls, redirectError } = setup();
  await assert.rejects(action({}, form({ topic: '가'.repeat(200), characterName: '나'.repeat(40), characterTraits: '다'.repeat(120) })), (error) => error === redirectError);
  assert.ok(calls[0][1].topic.includes('다'.repeat(120)));
  assert.ok(calls[0][1].topic.length <= 400);
});
