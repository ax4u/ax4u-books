import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFileSync, readdirSync } from 'node:fs';
import { getPublishedBook, publishedBooks } from '../src/lib/exhibition/catalog';

import * as fixtures from './gobibi-subpages-fixtures.mjs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Test-only infrastructure: no .env, Next server, real login, AI or provider calls.
test('loopback Supabase fixture exercises the real SDK, rejects all mutations, and separates empty/populated users', async () => {
  assert.equal(typeof fixtures.startFixtureServer, 'function', 'read-only fixture server must be implemented');
  const server = await fixtures.startFixtureServer({ port: 0 });
  try {
    const cookies = fixtures.fixtureCookies('populated', 'http://127.0.0.1:3199', server.origin);
    const db = createServerClient(server.origin, 'gobibi-test-only-anon', { cookies: { getAll: () => cookies, setAll: () => {} } });
    const { data: auth, error: authError } = await db.auth.getUser();
    assert.equal(authError, null);
    assert.equal(auth.user?.id, fixtures.USER_IDS.populated);
    const rows = await db.from('books').select('*').eq('user_id', auth.user!.id);
    assert.equal(rows.error, null);
    assert.deepEqual(new Set(rows.data!.map(row => row.status)), new Set(['draft', 'paid', 'generating', 'completed', 'failed']));
    const owned = await db.from('books').select('*').eq('id', fixtures.BOOK_IDS.completed).maybeSingle();
    assert.equal(owned.data?.status, 'completed');
    const empty = await db.from('books').select('*').eq('user_id', fixtures.USER_IDS.empty);
    assert.deepEqual(empty.data, []);
    const missing = await db.from('books').select('*').eq('id', fixtures.BOOK_IDS.missing).maybeSingle();
    assert.equal(missing.data, null);
    const error = await db.from('books').select('*').eq('id', fixtures.BOOK_IDS.error).maybeSingle();
    assert.match(error.error!.message, /GOBIBI_QA_EXPECTED_ERROR/);
    const write = await fetch(server.origin + '/rest/v1/books', { method: 'POST', body: '{}' });
    assert.equal(write.status, 405);
    const authClient = createClient(server.origin, 'gobibi-test-only-anon', { auth: { persistSession: false, autoRefreshToken: false } });
    const rejected = await authClient.auth.signInWithPassword({ email: 'qa@example.invalid', password: 'test-only-not-a-password' });
    assert.match(rejected.error!.message, /GOBIBI_QA_AUTH_REJECTED/);
    const signup = await authClient.auth.signUp({ email: 'qa@example.invalid', password: 'test-only-not-a-password' });
    assert.match(signup.error!.message, /GOBIBI_QA_AUTH_REJECTED/);
    assert.equal(server.events.filter(e => e.kind === 'mutation-rejected').length, 1);
  } finally { await server.close(); }
});
test('authenticated fixture configuration fails closed for remote and unacknowledged bases', async () => {
  const fixture = await import('./gobibi-subpages-fixtures.mjs').catch(() => null);
  assert.ok(fixture, 'test-only fixture safety module must exist');
  assert.throws(() => fixture.assertFixtureBase('https://gobibi.art', '1'), /loopback/);
  assert.throws(() => fixture.assertFixtureBase('http://127.0.0.1:3199', ''), /GOBIBI_QA_ISOLATED/);
  assert.throws(() => fixture.assertFixtureBase('http://127.0.0.1.evil.test:3199', '1'), /loopback/);
  assert.equal(fixture.assertFixtureBase('http://127.0.0.1:3199', '1').origin, 'http://127.0.0.1:3199');
});


test('isolated runner allowlists environment and keeps fixtures outside deployed pages', async () => {
  const runner = await import('./gobibi-subpages-runner.mjs').catch(() => null);
  assert.ok(runner, 'isolated runner must exist');
  const environment = runner.isolatedEnvironment({ PATH: process.env.PATH, HOME: '/tmp/qa-home', OPENAI_API_KEY: 'DO_NOT_INHERIT', SUPABASE_URL: 'https://unsafe.invalid', NODE_OPTIONS: '--unsafe', VERCEL_ENV: 'production' }, 'http://127.0.0.1:3199', 'http://127.0.0.1:3200', '/tmp/qa-guard.cjs');
  assert.ok(!('OPENAI_API_KEY' in environment));
  assert.ok(!('SUPABASE_URL' in environment));
  assert.equal(environment.VERCEL_ENV, 'development');
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:3200');
  assert.match(environment.NODE_OPTIONS, /qa-guard/);
  const pages = readdirSync('src/app', { recursive: true }).filter(name => String(name).endsWith('page.tsx')).map(String).sort();
  assert.deepEqual(pages, ['books/[id]/page.tsx','create/page.tsx','dashboard/page.tsx','exhibition/[slug]/page.tsx','exhibition/page.tsx','login/page.tsx','page.tsx','printing/[bookId]/page.tsx'].sort());
  for (const dir of ['src', 'public']) assert.ok(!readdirSync(dir, { recursive: true }).some(name => /gobibi-subpages|qa-fixture/.test(String(name))), 'no test fixture published');
});

test('production access policy and exhibition publication allowlist remain unchanged', () => {
  assert.deepEqual(publishedBooks.map(book => book.slug), ['planet-friends']);
  for (const slug of ['private-book','toString','__proto__','../planet-friends','']) assert.equal(getPublishedBook(slug), undefined);
  const auth = readFileSync('src/lib/auth.ts', 'utf8');
  assert.match(auth, /if \(!isLocalDemoAllowed\(\)\) return null/);
  const printing = readFileSync('src/app/printing/[bookId]/page.tsx', 'utf8');
  assert.match(printing, /createSupabaseServerClient/);
  assert.match(printing, /auth\.getUser/);
  assert.doesNotMatch(printing, /mockSignIn|mock_user_email/);
});


test('browser firewall blocks side-effecting GETs and every production mutation; coverage lists every state', async () => {
  const qa = await import('./gobibi-subpages-browser.mjs').catch(() => null);
  assert.ok(qa, 'integrated browser runner must exist without launching on import');
  const base = 'https://gobibi.art';
  for (const path of ['/api/mock-pay?bookId=qa', '/api/jobs/generate', '/api/books/qa/pdf', '/auth/callback?code=qa']) {
    assert.equal(qa.requestPolicy({ url: base + path, method: 'GET', base, fixture: false }), 'block');
  }
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) assert.equal(qa.requestPolicy({ url: base + '/login', method, base, fixture: false, allowLoginAction: true }), 'block');
  assert.equal(qa.requestPolicy({ url: base + '/exhibition/planet-friends', method: 'GET', base, fixture: false }), 'read');
  assert.equal(qa.requestPolicy({ url: 'https://api.openai.com/v1/images', method: 'POST', base, fixture: true }), 'block');
  assert.equal(qa.requestPolicy({ url: 'http://127.0.0.1:3199/login', method: 'POST', base: 'http://127.0.0.1:3199', fixture: true, allowLoginAction: true }), 'local-auth');
  const ids = qa.scenarios(true).map((item: { id: string }) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'scenario IDs must be unique');
  assert.equal(ids.length, 27);
  for (const path of ['/create', '/dashboard', '/books/qa', '/printing/qa', '/_next/image?url=https://unsafe.invalid/image.png', '/api%2Fmock-pay', '/%2561pi/mock-pay']) {
    assert.equal(qa.requestPolicy({ url: base + path, method: 'GET', base, fixture: false }), 'block', path);
  }
  for (const url of ['https://unsafe.invalid/home/a.png', 'http://127.0.0.1.evil.test:3199/login', 'https://gobibi.art/login']) {
    assert.equal(qa.requestPolicy({ url, method: 'POST', base: url, fixture: true, allowLoginAction: true }), 'block', url);
  }
  assert.equal(qa.requestPolicy({ url: 'http://127.0.0.1:3199/login', method: 'POST', base: 'http://127.0.0.1:3199', fixture: true, allowLoginAction: false }), 'block');
  assert.equal(qa.requestPolicy({ url: base + '/_next/static/chunks/main.js', method: 'GET', base, fixture: false }), 'read');
  assert.equal(qa.requestPolicy({ url: base + '/home/gobibi/arrival.webp', method: 'GET', base, fixture: false }), 'read');
  assert.ok(qa.scenarios(false).every((item: { user?: string; action?: string; path: string }) => !item.user && !['auth-error', 'quote', 'create', 'edit'].includes(item.action || '') && !/^\/(books|printing|dashboard|create)(\/|$)/.test(item.path)));
  const create = qa.scenarios(true).find((item: { id: string }) => item.id === 'create-inputs');
  const edit = qa.scenarios(true).find((item: { id: string }) => item.id === 'book-edit');
  assert.ok(create && 'noSubmit' in create && create.noSubmit === true);
  assert.ok(edit && 'noSave' in edit && edit.noSave === true);
  for (const id of ['exhibition','reader','login-signin','login-signup','login-query-error','login-signin-error','login-signup-error','create-inputs','dashboard-empty','dashboard-populated','book-draft','book-paid','book-generating','book-failed','book-completed','book-edit','printing-disabled','printing-mapping-error','printing-quote-success','printing-quote-error','printing-quote-network-error','not-found','exhibition-not-found','book-not-found','book-foreign','loading','error-boundary']) assert.ok(ids.includes(id), id);
});
