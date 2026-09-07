/* eslint-disable @typescript-eslint/no-require-imports -- Offline Node CJS test harness. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./backend-loader.cjs');

for (const [selected, otherKey] of [['openai', 'GEMINI_API_KEY'], ['gemini', 'OPENAI_API_KEY']]) {
  test(`missing ${selected} configuration never switches to another API provider`, () => {
    const env = load('src/lib/env.ts', {}, { AI_PROVIDER: selected, [otherKey]: 'offline-test-key' });
    assert.equal(env.resolveAiProvider(), 'mock');
  });
}
for (const [selected, key] of [['openai', 'OPENAI_API_KEY'], ['gemini', 'GEMINI_API_KEY']]) {
  test(`configured ${selected} stays explicitly selected`, () => {
    assert.equal(load('src/lib/env.ts', {}, { AI_PROVIDER: selected, [key]: 'offline-test-key' }).resolveAiProvider(), selected);
  });
}
test('unknown provider cannot silently select a paid API', () => {
  assert.equal(load('src/lib/env.ts', {}, { AI_PROVIDER: 'unsupported', OPENAI_API_KEY: 'offline' }).resolveAiProvider(), 'mock');
});
function getProvider(runtime) {
  return load('src/lib/ai/index.ts', {
    '@/lib/env': { resolveAiProvider: () => 'mock' },
    './openai': { openaiProvider: { name: 'openai' } },
    './gemini': { geminiProvider: { name: 'gemini' } },
  }, runtime).getAIProvider;
}
for (const runtime of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
  test(`deployed runtime ${JSON.stringify(runtime)} never returns mock AI`, () => {
    assert.throws(getProvider(runtime), /AI.*준비/);
  });
}
test('local unconfigured demo still uses mock AI', async () => {
  const ai = getProvider({ NODE_ENV: 'development' })();
  assert.equal(ai.name, 'mock');
  assert.match(await ai.generateImage('demo', {}), /^data:image\/png;base64,/);
});
