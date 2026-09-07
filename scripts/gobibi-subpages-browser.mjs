/** TEST ONLY: real UI / synthetic data, never a production auth or printing test.
 * Parent starts the isolated server with gobibi-subpages-runner.mjs --start.
 * BASE=http://127.0.0.1:3199 QA_MODE=fixture GOBIBI_QA_ISOLATED=1
 * QA_MANIFEST=/tmp/.../gobibi-qa-isolation.json node scripts/gobibi-subpages-browser.mjs
 * Public mode only visits public pages; no login submission or private cookies.
 * Optional: QA_OUTPUT, QA_WIDTHS=375,1440,320,768, QA_SCENARIOS=id,id,
 * PLAYWRIGHT_MODULE, CHROMIUM_PATH. Importing this module never launches anything.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertFixtureBase, BOOK_IDS, FIXTURE_MARKER, FIXTURE_SVG, fixtureCookies } from './gobibi-subpages-fixtures.mjs';

/** Fail closed: same-origin documented page/static reads only, never arbitrary API GETs. */
export function requestPolicy({ url, method, base, fixture = false, allowLoginAction = false }) {
  try {
    const target = new URL(url), origin = new URL(base);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== origin.origin || target.username || target.password) return 'block';
    const path = decodeURIComponent(target.pathname);
    if (/%|\\|\0/.test(path)) return 'block';
    if (fixture) assertFixtureBase(base, '1');
    if (method === 'POST' && fixture && allowLoginAction && path === '/login' && !target.search) return 'local-auth';
    if (!['GET', 'HEAD'].includes(method)) return 'block';
    if (/^\/(api|auth)(\/|$)/.test(path)) return 'block';
    // Optimizer is not an arbitrary upstream proxy during QA.
    if (path === '/_next/image') return target.searchParams.get('url') === '/home/gobibi/sangmung.webp' && /^\d+$/.test(target.searchParams.get('w') || '') && /^\d+$/.test(target.searchParams.get('q') || '') ? 'read' : 'block';
    if (/^\/_next\/static\//.test(path) || /^\/(home|exhibition|fonts|images)\/.*\.(?:avif|webp|png|jpe?g|svg|gif|woff2?|ttf)$/i.test(path) || /^\/(?:favicon\.ico|icon\.png|apple-icon\.png)$/.test(path)) return 'read';
    if (['/', '/login', '/exhibition', '/qa-this-page-does-not-exist'].includes(path) || /^\/exhibition\/[a-z0-9-]+$/.test(path)) return 'read';
    if (fixture && (['/create', '/dashboard'].includes(path) || /^\/(books|printing)\/[0-9a-f-]+$/.test(path))) return 'read';
    return 'block';
  } catch { return 'block'; }
}

export function scenarios(fixture = false) {
  const items = [
    { id: 'exhibition', path: '/exhibition', ready: 'main h1' },
    { id: 'reader', path: '/exhibition/planet-friends', ready: '[data-sketchbook-reader]' },
    { id: 'login-signin', path: '/login', ready: 'form input[name="email"]' },
    { id: 'login-signup', path: '/login', ready: 'form input[name="email"]', action: 'signup' },
    { id: 'login-query-error', path: '/login?error=GOBIBI_QA_QUERY_ERROR', ready: '[role="alert"]' },
    { id: 'not-found', path: '/qa-this-page-does-not-exist', ready: '[data-gobibi-not-found]' },
    { id: 'exhibition-not-found', path: '/exhibition/private-book', ready: '[data-gobibi-not-found]' },
  ];
  if (!fixture) return items;
  items.push(
    ...['signin', 'signup'].map(mode => ({ id: `login-${mode}-error`, path: '/login', ready: 'form input[name="password"]', action: 'auth-error', mode })),
    { id: 'create-inputs', path: '/create', user: 'populated', ready: 'textarea[name="topic"]', action: 'create', noSubmit: true },
    { id: 'dashboard-empty', path: '/dashboard', user: 'empty', ready: '#empty-shelf-title' },
    { id: 'dashboard-populated', path: '/dashboard', user: 'populated', ready: '[data-status="completed"]' },
    ...['draft', 'paid', 'generating', 'failed', 'completed'].map(state => ({ id: `book-${state}`, path: `/books/${BOOK_IDS[state]}`, user: 'populated', ready: `[data-status="${state}"]`, bookState: state })),
    { id: 'book-edit', path: `/books/${BOOK_IDS.completed}`, user: 'populated', ready: '[data-status="completed"]', action: 'edit', noSave: true },
    { id: 'printing-disabled', path: `/printing/${BOOK_IDS.printingDisabled}`, user: 'populated', ready: '#quote-title', action: 'disabled' },
    { id: 'printing-mapping-error', path: `/printing/${BOOK_IDS.printingError}`, user: 'populated', ready: '#quote-title', action: 'mapping-error' },
    ...['success', 'error', 'network-error'].map(quote => ({ id: `printing-quote-${quote}`, path: `/printing/${BOOK_IDS.completed}`, user: 'populated', ready: '#quote-title', action: 'quote', quote })),
    ...['missing', 'foreign'].map(state => ({ id: state === 'missing' ? 'book-not-found' : 'book-foreign', path: `/books/${BOOK_IDS[state]}`, user: 'populated', ready: '[data-gobibi-not-found]' })),
    { id: 'loading', path: `/books/${BOOK_IDS.slow}`, user: 'populated', ready: 'main[aria-busy="true"]', transient: true },
    { id: 'error-boundary', path: `/books/${BOOK_IDS.error}`, user: 'populated', ready: '[data-gobibi-error]' },
  );
  return items;
}

async function checkedFixture(base, env) {
  assertFixtureBase(base, env.GOBIBI_QA_ISOLATED);
  assert.ok(env.QA_MANIFEST, 'QA_MANIFEST from isolated --start runner required');
  const manifest = JSON.parse(readFileSync(env.QA_MANIFEST, 'utf8'));
  assert.equal(manifest.fixture, FIXTURE_MARKER);
  assert.equal(new URL(manifest.base).origin, base);
  assert.equal(manifest.guard, true, 'server egress guard required');
  assert.equal(manifest.syntheticPrintingReadiness, true);
  assert.equal(resolve(env.QA_MANIFEST), join(resolve(manifest.root), 'gobibi-qa-isolation.json'));
  assertFixtureBase(manifest.fixtureOrigin, '1');
  const response = await fetch(manifest.fixtureOrigin + '/__qa/health', { redirect: 'error', signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.fixture, FIXTURE_MARKER);
  assert.equal(health.readonly, true);
  return manifest;
}

async function auditPage(page) {
  return page.evaluate(() => {
    const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]');
    const name = el => el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || Array.from(el.labels || []).map(label => label.textContent).join(' ').trim() || el.textContent?.trim() || el.querySelector('img[alt]')?.getAttribute('alt') || el.getAttribute('title') || '';
    const controls = Array.from(document.querySelectorAll('button,a[href],input:not([type="hidden"]),textarea,select')).filter(visible);
    const missingReferences = Array.from(document.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls]')).flatMap(el => ['aria-describedby', 'aria-labelledby', 'aria-controls'].flatMap(attr => (el.getAttribute(attr) || '').split(/\s+/).filter(id => id && !document.getElementById(id)).map(id => ({ element: el.tagName, attr, id }))));
    return {
      title: document.title, lang: document.documentElement.lang,
      mainCount: document.querySelectorAll('main').length,
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).filter(visible).map(el => ({ level: el.tagName, text: el.textContent.trim() })),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      overflowElements: Array.from(document.querySelectorAll('main *')).filter(visible).filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).slice(0, 20).map(el => ({ tag: el.tagName, class: el.className?.toString(), text: el.textContent?.trim().slice(0, 70) })),
      unnamedControls: controls.filter(el => !name(el)).map(el => ({ tag: el.tagName, type: el.getAttribute('type') })),
      smallTargets: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).map(el => ({ name: name(el).slice(0, 60), tag: el.tagName })),
      missingReferences,
      missingAlt: Array.from(document.images).filter(el => !el.hasAttribute('alt')).map(el => el.currentSrc),
      brokenImages: Array.from(document.images).filter(el => visible(el) && el.complete && !el.naturalWidth).map(el => el.currentSrc),
      navigation: Array.from(document.querySelectorAll('nav a')).map(el => ({ text: name(el), href: el.getAttribute('href'), current: el.getAttribute('aria-current'), visible: visible(el) })),
      buttons: controls.filter(el => el.tagName === 'BUTTON').map(el => ({ name: name(el), disabled: el.disabled, pressed: el.getAttribute('aria-pressed'), expanded: el.getAttribute('aria-expanded') })),
      alerts: Array.from(document.querySelectorAll('[role="alert"],[role="status"]')).filter(visible).map(el => el.textContent.trim()),
    };
  });
}

async function capture(page, record, output, suffix = '', transient = false) {
  if (!transient) {
    await page.evaluate(async () => {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2500))]);
      // Lazy images are screenshot content too; load real URLs, never replace page DOM.
      document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
      await Promise.race([Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 5000))]);
    });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const file = `${record.id}-${record.width}${suffix}.png`;
  await page.screenshot({ path: join(output, file), fullPage: true, animations: 'disabled', timeout: 20000 });
  const audit = await auditPage(page);
  record.captures.push({ file, url: page.url(), audit });
  if (typeof page.locator('body').ariaSnapshot === 'function') writeFileSync(join(output, file.replace('.png', '.aria.yml')), await page.locator('body').ariaSnapshot());
  return audit;
}

async function exercise(page, item, record, output, gate) {
  if (item.action === 'signup' || item.mode === 'signup') {
    const tab = page.getByRole('group', { name: '로그인 또는 회원가입 선택' }).getByRole('button', { name: '회원가입', exact: true });
    await tab.click();
    await page.getByRole('heading', { name: '첫 이야기를 함께 시작해요.' }).waitFor();
    assert.equal(await tab.getAttribute('aria-pressed'), 'true');
  }
  if (item.action === 'auth-error') {
    await page.getByLabel('이메일', { exact: true }).fill('gobibi-qa@example.invalid');
    await page.locator('input[name="password"]').fill('TEST_ONLY_NOT_A_REAL_PASSWORD');
    gate.login = true;
    try {
      await page.locator('form button[type="submit"]').click();
      await page.locator('form[aria-busy="true"]').waitFor();
      assert.equal(await page.locator('form button[type="submit"]').isDisabled(), true);
      await capture(page, record, output, '-pending', true);
      await page.getByRole('alert').filter({ hasText: 'GOBIBI_QA_AUTH_REJECTED' }).waitFor({ timeout: 20000 });
      assert.equal(await page.locator('form').getAttribute('aria-busy'), 'false');
    } finally { gate.login = false; }
  }
  if (item.action === 'create') {
    await page.locator('[name="characterName"]').fill('[TEST ONLY] 상멍이');
    await page.locator('[name="characterTraits"]').fill('화면 QA 입력 — 생성하지 않는 가상 주인공');
    await page.locator('[name="topic"]').fill('[TEST ONLY] 구름 사이에서 작은 친구를 만나는 이야기. 제출하지 않습니다.');
    for (const [name, value] of Object.entries({ style: '파스텔 일러스트', pageCount: '12', ageGroup: '전 연령', language: 'ja' })) await page.locator(`[name="${name}"]`).selectOption(value);
    assert.equal(await page.locator('[name="pageCount"]').inputValue(), '12');
    record.note = 'Inputs only; no submit, book creation or checkout.';
  }
  if (item.action === 'edit') {
    await page.getByRole('button', { name: '편집', exact: true }).click();
    await page.getByLabel('제목', { exact: true }).fill('[TEST ONLY] 저장하지 않는 제목');
    await page.getByRole('textbox', { name: '본문', exact: true }).first().fill('[TEST ONLY] 저장하지 않는 편집 원고');
    await page.getByRole('textbox', { name: '이미지 프롬프트', exact: true }).first().fill('TEST ONLY — no generation');
    assert.equal(await page.getByRole('button', { name: '저장', exact: true }).isVisible(), true);
    record.note = 'Client editor only; no save, delete, retry, regeneration or PDF request.';
  }
  if (['disabled', 'mapping-error', 'quote'].includes(item.action)) {
    const button = page.getByRole('button', { name: '견적 확인 (주문 아님)', exact: true });
    if (item.action !== 'quote') {
      assert.equal(await button.isDisabled(), true);
      assert.equal(await page.getByLabel('인쇄 견적 수량').isDisabled(), true);
      if (item.action === 'mapping-error') assert.match(await page.locator('#quote-reason').innerText(), /확인할 수 없습니다/);
    } else {
      assert.equal(await button.isEnabled(), true, 'Synthetic sandbox binding must be ready');
      const input = page.getByLabel('인쇄 견적 수량');
      for (const value of ['0', '201', '1.5']) { await input.fill(value); assert.equal(await button.isDisabled(), true); }
      await input.fill('2');
      gate.quote = true;
      try {
        await button.click();
        await page.locator('section[aria-busy="true"]').waitFor();
        await capture(page, record, output, '-pending', true);
        const message = item.quote === 'success' ? '공급사 예상 비용:' : item.quote === 'error' ? '견적을 확인할 수 없습니다.' : '견적 연결에 실패했습니다.';
        await page.getByRole('status').filter({ hasText: message }).waitFor();
      } finally { gate.quote = false; }
      record.note = 'TEST ONLY synthetic quote, fulfilled/aborted in browser; no server or provider quote request.';
    }
  }
  if (item.bookState === 'paid' || item.bookState === 'generating') {
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '0');
  }
}

async function navigationChecks(page, item, record, output) {
  if (item.transient) return;
  const menu = page.getByRole('button', { name: '메뉴 열기', exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    assert.equal(await page.getByRole('button', { name: '메뉴 닫기', exact: true }).getAttribute('aria-expanded'), 'true');
    await capture(page, record, output, '-menu');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: '메뉴 열기', exact: true }).getAttribute('aria-expanded'), 'false');
  }
  const skip = page.getByRole('link', { name: '본문 바로가기', exact: true });
  if (await skip.count()) {
    await skip.focus();
    await page.keyboard.press('Enter');
    record.skipTarget = await page.evaluate(() => document.activeElement?.id);
    assert.equal(record.skipTarget, 'gobibi-main');
  }
  if (item.id === 'reader') {
    const reader = page.getByRole('region', { name: '그림책 읽기', exact: true });
    await reader.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('[data-source-page="1"]') !== null);
    await capture(page, record, output, '-next-page');
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('[data-source-page="0"]') !== null);
  }
}

async function runScenario(browser, item, width, config) {
  const { base, fixture, manifest, output } = config;
  const record = { id: item.id, width, path: item.path, synthetic: fixture && !!(item.user || item.action === 'auth-error'), captures: [], console: [], pageErrors: [], network: [], status: 'running' };
  const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 1000 : 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
  const gate = { login: false, quote: false };
  try {
    if (item.user) await context.addCookies(fixtureCookies(item.user, base, manifest.fixtureOrigin));
    // Isolated dev needs same-loopback HMR to hydrate. Every other websocket is denied; no service workers or inherited auth.
    if (typeof context.routeWebSocket !== 'function') throw new Error('Playwright routeWebSocket support required for fail-closed QA');
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      if (fixture && url.host === new URL(base).host && url.pathname === '/_next/webpack-hmr') socket.connectToServer();
      else socket.close();
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method();
      const log = kind => record.network.push({ method, url: request.url(), kind });
      const local = fixture && url.origin === base;
      const asset = /^\/api\/books\/([0-9a-f-]+)\/(?:assets\/\d+|cover)$/.exec(url.pathname);
      if (local && method === 'GET' && asset && Object.values(BOOK_IDS).includes(asset[1])) {
        log('synthetic-image'); return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: FIXTURE_SVG });
      }
      const status = /^\/api\/books\/([0-9a-f-]+)\/status$/.exec(url.pathname);
      if (local && method === 'GET' && status && Object.values(BOOK_IDS).includes(status[1])) {
        log('synthetic-status');
        const state = Object.entries(BOOK_IDS).find(([, id]) => id === status[1])?.[0];
        return route.fulfill({ status: 200, json: { status: state, imagesReady: 0, pagesReady: 4, pageCount: 4, updatedAt: new Date().toISOString(), testOnly: true } });
      }
      if (local && method === 'POST' && url.pathname === '/api/printing/quote' && gate.quote && item.action === 'quote') {
        log('synthetic-quote-' + item.quote);
        await new Promise(resolve => setTimeout(resolve, 2500));
        if (item.quote === 'network-error') return route.abort('connectionfailed');
        return route.fulfill({ status: item.quote === 'success' ? 200 : 422, json: { testOnly: true, success: item.quote === 'success', data: { paidCreditAmount: 12345 }, message: 'TEST ONLY synthetic quote; no order or charge' } });
      }
      const policy = requestPolicy({ url: request.url(), method, base, fixture, allowLoginAction: gate.login && !!request.headers()['next-action'] });
      log(policy);
      if (policy === 'block') return route.abort('blockedbyclient');
      if (!fixture || policy === 'local-auth') {
        // route.continue() may follow redirect chains without re-running this
        // handler. Fetch at most this exact URL; never forward a 30x to Chrome.
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 120000 });
        if (response.status() >= 300 && response.status() < 400) {
          log('redirect-blocked');
          return route.fulfill({ status: 409, contentType: 'text/plain', body: 'GOBIBI_QA_REDIRECT_BLOCKED: read-only runner never follows unverified redirects' });
        }
        return route.fulfill({ response });
      }
      // Loopback fixture page reads stream directly so loading.tsx is observable.
      // Its server is already isolated and rejects all upstream network egress.
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) record.console.push({ type: message.type(), text: message.text() }); });
    page.on('pageerror', error => record.pageErrors.push(error.message));
    page.on('dialog', dialog => { record.network.push({ kind: 'dialog-dismissed', message: dialog.message() }); void dialog.dismiss(); });
    page.on('download', download => { record.network.push({ kind: 'download-cancelled' }); void download.cancel(); });
    const response = await page.goto(base + item.path, { waitUntil: 'commit', timeout: 120000 });
    record.httpStatus = response?.status();
    await page.locator(item.ready).first().waitFor({ timeout: 120000 });
    if (!item.transient) {
      await page.waitForLoadState('domcontentloaded', { timeout: 120000 });
      // Allow React hydration before interacting with server-rendered controls.
      await page.waitForFunction(() => {
        const button = document.querySelector('header button');
        if (!button) return true;
        return Object.keys(button).some(key => key.startsWith('__reactProps$') && typeof button[key]?.onClick === 'function');
      }, null, { timeout: 30000 });
    }
    await exercise(page, item, record, output, gate);
    const audit = await capture(page, record, output, '', !!item.transient);
    await navigationChecks(page, item, record, output);
    record.findings = [];
    if (audit.overflow > 1) record.findings.push(`Horizontal overflow: ${audit.overflow}px`);
    if (audit.mainCount !== 1) record.findings.push(`main count: ${audit.mainCount}`);
    if (!audit.headings.some(h => h.level === 'H1')) record.findings.push('Missing visible h1');
    for (const key of ['unnamedControls', 'missingReferences', 'missingAlt', 'brokenImages']) if (audit[key].length) record.findings.push(`${key}: ${audit[key].length}`);
    const unexpected = record.pageErrors.filter(text => !(item.id === 'error-boundary' && text.includes('GOBIBI_QA_EXPECTED_ERROR')));
    if (unexpected.length) record.findings.push(`Uncaught page errors: ${unexpected.length}`);
    record.status = record.findings.length ? 'findings' : 'passed';
  } catch (error) {
    record.status = 'failed'; record.error = error.stack || String(error);
    const page = context.pages()[0];
    if (page && !page.isClosed()) {
      try { await capture(page, record, output, '-failure', true); } catch (captureError) { record.captureError = String(captureError); }
    }
  } finally { await context.close(); }
  return record;
}

export async function main(env = process.env) {
  const mode = env.QA_MODE || 'public';
  assert.ok(['fixture', 'public'].includes(mode), 'QA_MODE must be fixture or public');
  assert.ok(env.BASE, 'Explicit BASE is required');
  const parsed = new URL(env.BASE);
  assert.ok(['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash, 'BASE must be an HTTP(S) origin without credentials');
  const base = parsed.origin, fixture = mode === 'fixture';
  const manifest = fixture ? await checkedFixture(base, env) : null;
  const widths = (env.QA_WIDTHS || '375,1440,320,768').split(',').map(Number);
  assert.ok(widths.length > 0 && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 2560), 'Invalid QA_WIDTHS');
  let selected = scenarios(fixture);
  if (env.QA_SCENARIOS) {
    const ids = env.QA_SCENARIOS.split(',');
    for (const id of ids) assert.ok(selected.some(item => item.id === id), `Unknown or unavailable scenario: ${id}`);
    selected = selected.filter(item => ids.includes(item.id));
  }
  const output = resolve(env.QA_OUTPUT || `scripts/gobibi-subpages-output/${new Date().toISOString().replaceAll(':', '-')}`);
  mkdirSync(output, { recursive: true });
  const runtime = env.PLAYWRIGHT_MODULE || '/home/hermes/.hermes/profiles/sejongchief/workspace/imageclass_flipbook/browser-runtime/node_modules/playwright/index.mjs';
  const { chromium } = await import(pathToFileURL(resolve(runtime)).href);
  const browser = await chromium.launch({ executablePath: env.CHROMIUM_PATH || '/home/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'] });
  const report = { mode, base, createdAt: new Date().toISOString(), synthetic: fixture, note: fixture ? 'TEST ONLY isolated UI evidence. Synthetic auth/users/books/images/bindings/quotes; never production readiness or real provider verification.' : 'Read-only public UI. Protected/transactional states are NOT exercised.', widths, planned: selected.map(item => item.id), results: [] };
  const save = () => writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  try {
    for (const item of selected) for (const width of widths) {
      const record = await runScenario(browser, item, width, { base, fixture, manifest, output });
      report.results.push(record); save();
      console.log(`${record.status}: ${item.id} @ ${width}${record.error ? ' — ' + record.error.split('\n')[0] : ''}`);
    }
  } finally { await browser.close(); save(); }
  if (fixture) {
    const response = await fetch(manifest.fixtureOrigin + '/__qa/events', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    report.fixtureEvents = await response.json();
    report.safetyFindings = report.fixtureEvents.filter(event => ['mutation-rejected', 'unhandled'].includes(event.kind));
  }
  report.summary = { total: report.results.length, passed: report.results.filter(r => r.status === 'passed').length, findings: report.results.filter(r => r.status === 'findings').length, failed: report.results.filter(r => r.status === 'failed').length, screenshots: report.results.reduce((n, r) => n + r.captures.length, 0) };
  save();
  writeFileSync(join(output, 'report.md'), `# Gobibi subpage QA\n\n${report.note}\n\nBase: ${base}\n\n${JSON.stringify(report.summary)}\n\n| Scenario | Width | Result | Evidence |\n|---|---:|---|---|\n${report.results.map(r => `| ${r.id} | ${r.width} | ${r.status} | ${r.captures.map(c => `[${c.file}](${c.file})`).join(', ')} |`).join('\n')}\n\nDetailed checks, errors, request firewall events, ARIA snapshots and limitations are in report.json. Automated accessibility checks are heuristic, not a WCAG certification. Public mode intentionally omits authenticated states. No create/save/payment/generation/PDF/order/mail action is performed. Synthetic pending/auth failure and quote screenshots are labelled TEST ONLY in report metadata.\n`);
  console.log(JSON.stringify({ output, ...report.summary }, null, 2));
  if (report.summary.failed || report.summary.findings || report.safetyFindings?.length) process.exitCode = 1;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
