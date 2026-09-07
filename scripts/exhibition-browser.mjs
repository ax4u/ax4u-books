import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
const base = process.env.TEST_BASE_URL || 'http://localhost:3100';
const errors = [];
const idle = p => p.waitForFunction(() => document.querySelector('[data-book-spread]')?.dataset.turning === 'idle');
async function spread(p, label, left, right) {
  await idle(p);
  assert.match(await p.getByRole('status').innerText(), label);
  for (const [side, expected] of [['left', left], ['right', right]]) {
    const sheet = p.locator(`[data-spread-side="${side}"]`);
    assert.equal(await sheet.getAttribute('data-blank'), String(expected === null));
    assert.equal(await sheet.locator('img').count(), expected === null ? 0 : 1);
    if (expected !== null) assert.equal(await sheet.locator('img').getAttribute('data-source-page'), String(expected));
  }
}
async function turn(p, direction, front, back, underLeft, underRight) {
  await p.getByRole('button', { name: direction === 'forward' ? '다음 페이지' : '이전 페이지' }).click();
  const leaf = p.locator('[data-turning-leaf]');
  await leaf.waitFor();
  // Freeze real CSS animation at its midpoint so assertions cannot race its end.
  await leaf.evaluate(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = 425; }));
  assert.equal(await p.locator('[data-book-spread]').getAttribute('data-turning'), direction);
  for (const [face, expected] of [['front', front], ['back', back]]) {
    const img = leaf.locator(`[data-leaf-face="${face}"] img`);
    assert.equal(await img.count(), expected === null ? 0 : 1);
    if (expected !== null) assert.equal(await img.getAttribute('data-source-page'), String(expected));
    assert.equal(await leaf.locator(`[data-leaf-face="${face}"]`).evaluate(el => getComputedStyle(el).backfaceVisibility), 'hidden');
  }
  for (const [side, expected] of [['left', underLeft], ['right', underRight]]) {
    const img = p.locator(`[data-spread-side="${side}"] img`);
    assert.equal(await img.count(), expected === null ? 0 : 1);
    if (expected !== null) assert.equal(await img.getAttribute('data-source-page'), String(expected));
  }
  assert.equal(await p.getByRole('button', { name: '다음 페이지' }).isDisabled(), true);
  assert.equal(await p.getByRole('button', { name: '이전 페이지' }).isDisabled(), true);
  assert.equal(await p.getByLabel('페이지 선택').isDisabled(), true);
  const transform = await leaf.evaluate(el => getComputedStyle(el).transform);
  assert.match(transform, /^matrix3d/);
  const titleBox = await p.getByRole('heading', { level: 1 }).boundingBox();
  const progressBox = await p.getByRole('progressbar').boundingBox();
  for (const time of [100, 250, 425, 600]) {
    await leaf.evaluate((el, time) => el.getAnimations().forEach(a => { a.currentTime = time; }), time);
    const box = await leaf.boundingBox();
    assert.ok(box.y >= titleBox.y + titleBox.height && box.y + box.height <= progressBox.y, 'rotating leaf stays clear of title, progress and controls without cropping');
  }
  await leaf.evaluate(el => el.getAnimations().forEach(a => { a.currentTime = 425; }));
  await p.getByRole('region', { name: '그림책 읽기' }).focus();
  await p.keyboard.press('End'); // locked input must not interrupt this turn
  await p.screenshot({ path: `/tmp/ax4u-exhibition-${direction}-midpoint.png`, fullPage: true });
  await leaf.evaluate(el => el.getAnimations().forEach(a => a.play()));
  await idle(p);
}
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('link', { name: '오픈 그림책 전시회', exact: true }).click();
  await page.waitForURL(base + '/exhibition');
  await page.getByRole('link', { name: /행성 친구들의 우당당탕 여행/ }).click();
  await page.getByRole('region', { name: '그림책 읽기' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/exhibition/planet-friends');
  await spread(page, /앞표지/, null, 0);
  assert.equal(await page.getByRole('button', { name: '이전 페이지' }).isDisabled(), true);
  await turn(page, 'forward', 0, null, null, 1);
  await spread(page, /본문 1쪽/, null, 1);
  await turn(page, 'forward', 1, 2, null, 3);
  await spread(page, /본문 2–3쪽/, 2, 3);
  await turn(page, 'reverse', 2, 1, null, 3);
  await spread(page, /본문 1쪽/, null, 1);
  await turn(page, 'reverse', null, 0, null, 1);
  await spread(page, /앞표지/, null, 0);
  await page.getByLabel('페이지 선택').selectOption('27');
  await spread(page, /본문 26–27쪽/, 26, 27);
  assert.equal(await page.getByLabel('페이지 선택').inputValue(), '27');
  await turn(page, 'forward', 27, 28, 26, null);
  await spread(page, /본문 28쪽/, 28, null);
  assert.equal(await page.getByRole('button', { name: '다음 페이지' }).isDisabled(), true);
  assert.equal(await page.getByRole('progressbar').getAttribute('value'), '29');
  await turn(page, 'reverse', 28, 27, 26, null);
  await spread(page, /본문 26–27쪽/, 26, 27);
  await page.getByRole('region', { name: '그림책 읽기' }).focus();
  await page.keyboard.press('Home'); await spread(page, /앞표지/, null, 0);
  await page.keyboard.press('End'); await spread(page, /본문 28쪽/, 28, null);
  const notFound = await page.goto(base + '/exhibition/private-book');
  assert.equal(notFound.status(), 404);

  const mobile = await context.newPage();
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.setViewportSize({ width: 375, height: 812 });
  await mobile.emulateMedia({ reducedMotion: 'reduce' });
  const images = new Set();
  mobile.on('request', r => { if (r.url().includes('/exhibition/planet-friends/') && r.url().endsWith('.png')) images.add(r.url()); });
  await mobile.goto(base + '/exhibition/planet-friends');
  await spread(mobile, /앞표지/, null, 0);
  assert.ok(images.size <= 2, `Initial spread fetched ${images.size} original PNGs`);
  const stage = mobile.locator('[data-page-stage]');
  async function swipe(dx, dy = 0) {
    await stage.evaluate((el, [dx, dy]) => {
      const start = new Touch({ identifier: 1, target: el, clientX: 180, clientY: 200 });
      const end = new Touch({ identifier: 1, target: el, clientX: 180 + dx, clientY: 200 + dy });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }));
    }, [dx, dy]);
  }
  await swipe(-100); await spread(mobile, /본문 1쪽/, null, 1);
  assert.equal(await mobile.locator('[data-turning-leaf]').count(), 0);
  await swipe(-100); await spread(mobile, /본문 2–3쪽/, 2, 3);
  await swipe(10, 100); await spread(mobile, /본문 2–3쪽/, 2, 3);
  await swipe(100); await spread(mobile, /본문 1쪽/, null, 1);
  // Every original page maps to the proper recto/verso, no inserted source entries.
  assert.equal(await mobile.getByLabel('페이지 선택').locator('option').count(), 29);
  for (let p = 1; p <= 28; p++) {
    await mobile.getByLabel('페이지 선택').selectOption(String(p));
    const side = p % 2 ? 'right' : 'left';
    assert.equal(await mobile.locator(`[data-spread-side="${side}"] img`).getAttribute('data-source-page'), String(p));
    assert.equal(await mobile.locator('[data-turning-leaf]').count(), 0);
  }
  await mobile.getByLabel('페이지 선택').selectOption('3');
  for (const viewport of [{ width: 375, height: 812 }, { width: 320, height: 640 }, { width: 812, height: 375 }]) {
    await mobile.setViewportSize(viewport);
    await mobile.waitForFunction(() => [...document.querySelectorAll('[data-page-image]')].every(i => i.complete && i.naturalWidth > 0));
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    const geometry = await mobile.locator('[data-book-spread]').boundingBox();
    assert.ok(geometry.width > geometry.height, 'facing spread stays landscape');
    for (const img of await mobile.locator('[data-page-image]').all()) {
      const metrics = await img.evaluate(el => ({ fit: getComputedStyle(el).objectFit, natural: el.naturalWidth / el.naturalHeight, declared: +el.getAttribute('width') / +el.getAttribute('height'), transform: getComputedStyle(el).transform }));
      assert.equal(metrics.fit, 'contain'); assert.equal(metrics.natural, metrics.declared); assert.equal(metrics.transform, 'none');
    }
  }
  await mobile.setViewportSize({ width: 375, height: 812 });
  await mobile.screenshot({ path: '/tmp/ax4u-exhibition-mobile.png', fullPage: true });
  await page.goto(base + '/exhibition/planet-friends');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByLabel('페이지 선택').selectOption('3');
  await spread(page, /본문 2–3쪽/, 2, 3);
  await page.screenshot({ path: '/tmp/ax4u-exhibition-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: anonymous routes + unknown slug 404; cover / body1 / 2–3 / 26–27 / 28; all 29 selectors recto/verso; forward/reverse double-sided leaf + static underlay + real midpoint matrix3d; locked controls/keyboard; Home/End boundaries + progress; mobile swipes, reduced motion instant, 320/375/812px no overflow + landscape spread + native image ratios; lazy initial images; no browser errors');
} finally { await browser.close(); }
