/* eslint-disable @typescript-eslint/no-require-imports -- Offline Node CJS test harness. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./backend-loader.cjs');

const options = { style: 'watercolor', pageCount: 4, language: 'ko', ageGroup: 'child' };
function provider(name, respond) {
  const mocks = { '@/lib/env': { env: {} } };
  if (name === 'openai') {
    mocks.openai = { __esModule: true, default: class {
      images = { generate: respond, edit: respond };
      chat = { completions: { create: respond } };
    }, toFile: async () => ({}) };
  } else {
    mocks['@google/genai/node'] = { GoogleGenAI: class {
      models = { generateContent: respond };
    }, Modality: { IMAGE: 'IMAGE' } };
  }
  return load(`src/lib/ai/${name}.ts`, mocks)[`${name}Provider`];
}
for (const name of ['openai', 'gemini']) {
  for (const failure of ['exception', 'empty response']) {
    test(`${name} image ${failure} rejects sanitized error, never placeholder success`, async (t) => {
      t.mock.method(global, 'setTimeout', (fn) => { queueMicrotask(fn); });
      let calls = 0;
      const ai = provider(name, async () => {
        calls++;
        if (failure === 'exception') throw new Error('SECRET credential; private prompt; upstream payload');
        return {};
      });
      await assert.rejects(ai.generateImage('private prompt', options), (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /이미지.*실패/);
        assert.doesNotMatch(error.message, /SECRET|private prompt|upstream/);
        assert.equal(error.cause, undefined);
        return true;
      });
      assert.equal(calls, name === 'openai' ? 3 : 1);
    });
  }
  test(`${name} passes through real image response`, async () => {
    const ai = provider(name, async () => name === 'openai'
      ? { data: [{ b64_json: 'image-bytes' }] }
      : { candidates: [{ content: { parts: [{ inlineData: { data: 'image-bytes', mimeType: 'image/png' } }] } }] });
    assert.equal(await ai.generateImage('scene', options), 'data:image/png;base64,image-bytes');
  });
}
