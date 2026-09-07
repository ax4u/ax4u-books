/** TEST ONLY. Never import from src/, public/, or a deployed route.
 * Read-only loopback Supabase protocol fixture; NOT a production auth bypass.
 * Every user, token, manuscript, mapping and quote is synthetic and labelled.
 */
import { createServer } from 'node:http';

export function assertFixtureBase(base, acknowledgement) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Authenticated QA requires an http loopback base');
  }
  if (acknowledgement !== '1') throw new Error('Set GOBIBI_QA_ISOLATED=1 only for the isolated test runner');
  return url;
}

export const USER_IDS = Object.freeze({ populated: '00000000-0000-4000-8000-000000000101', empty: '00000000-0000-4000-8000-000000000102' });
export const BOOK_IDS = Object.freeze(Object.fromEntries(['draft', 'paid', 'generating', 'completed', 'failed', 'printingDisabled', 'printingError', 'slow', 'error', 'missing', 'foreign'].map((state, i) => [state, `00000000-0000-4000-8000-${String(201 + i).padStart(12, '0')}`])));
export const FIXTURE_MARKER = 'gobibi-read-only-subpages-v1';
export const FIXTURE_DATE = '2026-01-01T00:00:00.000Z';
export const FIXTURE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fff1bc"/><circle cx="256" cy="225" r="115" fill="#8573b7"/><text x="256" y="412" text-anchor="middle" font-size="28" fill="#332b48">TEST ONLY · NOT ARTWORK</text></svg>';

function fixtureUser(kind) {
  if (!Object.hasOwn(USER_IDS, kind)) throw new Error('Unknown fixture user');
  return { id: USER_IDS[kind], email: `gobibi-qa-${kind}@example.invalid`, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { test_only: true }, created_at: FIXTURE_DATE };
}

export function fixtureCookies(kind, base, supabaseOrigin) {
  const url = assertFixtureBase(base, '1');
  const supabase = assertFixtureBase(supabaseOrigin, '1');
  const user = fixtureUser(kind);
  const expires = Math.floor(Date.now() / 1000) + 86_400;
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  // Deliberately invalid signature: accepted only by our loopback fake, never Supabase.
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expires, qa: kind })}.TEST_ONLY_NOT_SIGNED`;
  const value = 'base64-' + encode({ access_token, refresh_token: `TEST_ONLY_${kind}`, token_type: 'bearer', expires_in: 86_400, expires_at: expires, user });
  return [{ name: `sb-${supabase.hostname.split('.')[0]}-auth-token`, value, url: url.origin, httpOnly: true, secure: false, sameSite: 'Lax' }];
}

export function fixtureRows() {
  return Object.entries(BOOK_IDS).filter(([key]) => !['missing', 'error'].includes(key)).map(([key, id]) => {
    const status = ['draft', 'paid', 'generating', 'failed'].includes(key) ? key : 'completed';
    const hasImages = status === 'completed';
    return { id, user_id: key === 'foreign' ? '00000000-0000-4000-8000-000000000199' : USER_IDS.populated,
      title: `[TEST ONLY] ${key} 그림책 — 구름과 작은 친구들의 아주 긴 산책 이야기`, topic: '격리된 디자인 QA 예시 원고입니다. 실제 생성·결제·인쇄하지 않습니다.',
      status, options: { style: '수채화', pageCount: 4, ageGroup: '3-5', language: 'ko' },
      pages: Array.from({ length: 4 }, (_, index) => ({ index, text: `[TEST ONLY] ${index + 1}쪽. 실제 고객 원고가 아닌 화면 검증용 문장입니다.`, imagePrompt: 'Synthetic QA only', imagePath: hasImages ? `qa/${id}/${index}.svg` : null, image: null })),
      cover_image_path: hasImages ? `qa/${id}/0.svg` : null, pdf_path: null, checkout_id: null,
      error: status === 'failed' ? 'GOBIBI_QA_EXPECTED_FAILURE · 화면 검증용 실패 상태입니다.' : null,
      created_at: FIXTURE_DATE, updated_at: FIXTURE_DATE,
    };
  });
}

function binding(bookId) {
  if (bookId === BOOK_IDS.printingDisabled) return null;
  return { user_id: USER_IDS.populated, book_id: bookId, environment: 'sandbox', provider_book_uid: 'TEST_ONLY_BOOK', book_spec_uid: 'TEST_ONLY_SPEC',
    page_count: 24, finalized: true, source_updated_at: FIXTURE_DATE, finalized_at: FIXTURE_DATE,
    inner_pdf_sha256: '0'.repeat(64), cover_pdf_sha256: '0'.repeat(64), trim_width_mm: 210, trim_height_mm: 210, bleed_mm: 3, binding_type: 'TEST_ONLY', cover_type: 'TEST_ONLY' };
}

/** Binds only 127.0.0.1. It has no credentials, DB connection, filesystem mutation or upstream. */
export async function startFixtureServer({ port = 0, authDelayMs = 1600, slowDelayMs = 8000 } = {}) {
  const events = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const event = { method: req.method, path: url.pathname, query: url.search, kind: 'read' };
    events.push(event);
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Gobibi-QA': FIXTURE_MARKER }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && url.pathname === '/__qa/health') return send(200, { fixture: FIXTURE_MARKER, readonly: true });
    if (req.method === 'GET' && url.pathname === '/__qa/events') return send(200, events);
    if (req.method === 'POST' && ['/auth/v1/token', '/auth/v1/signup'].includes(url.pathname)) {
      event.kind = 'auth-rejected';
      req.resume();
      await new Promise(resolve => setTimeout(resolve, authDelayMs));
      return send(400, { code: 'invalid_credentials', msg: 'GOBIBI_QA_AUTH_REJECTED · 테스트 전용 응답입니다. 계정이나 메일을 만들지 않았습니다.' });
    }
    if (!['GET', 'HEAD'].includes(req.method)) { event.kind = 'mutation-rejected'; req.resume(); return send(405, { message: 'TEST_ONLY_READ_ONLY: all mutations rejected' }); }
    if (url.pathname === '/auth/v1/user') {
      try {
        const token = (req.headers.authorization || '').replace(/^Bearer /, '');
        const kind = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).qa;
        if (!token.endsWith('.TEST_ONLY_NOT_SIGNED')) throw new Error('not fixture');
        return send(200, fixtureUser(kind));
      } catch { return send(401, { msg: 'Fixture session missing', code: 'bad_jwt' }); }
    }
    if (url.pathname === '/rest/v1/books') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (id === BOOK_IDS.error) return send(500, { message: 'GOBIBI_QA_EXPECTED_ERROR', code: 'QA_ERROR' });
      if (id === BOOK_IDS.slow) await new Promise(resolve => setTimeout(resolve, slowDelayMs));
      let rows = fixtureRows();
      for (const key of ['id', 'user_id']) {
        const query = url.searchParams.get(key);
        if (query?.startsWith('eq.')) rows = rows.filter(row => row[key] === query.slice(3));
        if (query?.startsWith('in.(')) { const ids = query.slice(4, -1).split(',').map(s => s.replaceAll('"', '')); rows = rows.filter(row => ids.includes(row[key])); }
      }
      // Supabase .maybeSingle() GET requests use an array accept header; let SDK unwrap.
      return send(200, req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows);
    }
    if (url.pathname === '/rest/v1/print_book_bindings') {
      const id = url.searchParams.get('book_id')?.replace(/^eq\./, '');
      if (id === BOOK_IDS.printingError) return send(500, { message: 'GOBIBI_QA_EXPECTED_MAPPING_ERROR', code: 'QA_ERROR' });
      const row = binding(id);
      return send(200, req.headers.accept?.includes('vnd.pgrst.object') ? row : row ? [row] : []);
    }
    event.kind = 'unhandled';
    return send(404, { message: 'TEST_ONLY_UNHANDLED_FIXTURE_REQUEST' });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, events, close: () => new Promise((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }) };
}
