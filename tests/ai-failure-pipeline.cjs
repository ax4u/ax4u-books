/* eslint-disable @typescript-eslint/no-require-imports -- Offline Node CJS test harness. */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./backend-loader.cjs');

for (const failure of ['image', 'configuration']) {
  test(`${failure} failure marks the book failed without persisting placeholder or completion`, async (t) => {
    t.mock.method(console, 'error', () => {});
    const error = new Error('AI 이미지 생성에 실패했습니다.');
    const updates = [];
    let assetWrites = 0;
    const book = { id: 'b1', status: 'generating', topic: 'topic', options: {}, pages: [{ index: 0, text: 'page', imagePrompt: 'scene', image: null, imagePath: null }] };
    const { runGeneration } = load('src/lib/ai/storybook.ts', {
      './index': { getAIProvider: () => {
        if (failure === 'configuration') throw error;
        return { generateImage: async () => { throw error; } };
      } },
      '@/lib/env': { env: { imageGenerationConcurrency: 1 } },
      '@/lib/books/store': {
        getBook: async () => book,
        updateBook: async (_id, update) => { updates.push(update); Object.assign(book, update); return book; },
      },
      '@/lib/books/assets': { pageImageDataUrl: async () => null, storePageImage: async () => { assetWrites++; } },
    });
    await assert.rejects(runGeneration('b1'), (err) => err === error);
    assert.equal(book.status, 'failed');
    assert.equal(book.error, error.message);
    assert.equal(assetWrites, 0);
    assert.equal(updates.some((update) => update.status === 'completed'), false);
    assert.equal(book.pages[0].image, null);
  });
}
