/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./backend-loader.cjs');
const env = { appUrl: 'https://gobibi.art', supabaseUrl: 'https://auth.example', supabaseAnonKey: 'public-key' };
function actions(auth, configured = true, googleEnabled = true, origin = env.appUrl) {
  return load('src/app/auth/actions.ts', {
    '@/lib/env': { env, isSupabaseConfigured: configured },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => configured ? { auth } : null },
    '@/lib/auth': { mockSignIn: () => assert.fail('must not bypass auth'), mockSignOut: async () => {} },
    '@/lib/google-auth': { isGoogleAuthEnabled: async () => googleEnabled },
    'next/headers': { headers: async () => new Headers({ origin }) },
    'next/navigation': { redirect: (url) => { throw new Error(`REDIRECT:${url}`); } },
  });
}
function credentials(password = 'secret123') {
  const data = new FormData(); data.set('email', ' reader@example.com '); data.set('password', password); return data;
}
test('Google starts OAuth with fixed callback and server PKCE client', async () => {
  const action = actions({ signInWithOAuth: async (input) => {
    assert.equal(input.provider, 'google');
    assert.equal(input.options.redirectTo, 'https://gobibi.art/auth/callback');
    assert.equal(input.options.skipBrowserRedirect, true);
    return { data: { url: 'https://auth.example/auth/v1/authorize?provider=google' }, error: null };
  } });
  await assert.rejects(action.signInWithGoogleAction({}, new FormData()), /REDIRECT:https:\/\/auth.example/);
});
test('disabled Google fails closed even if action is called directly', async () => {
  const result = await actions({}, true, false).signInWithGoogleAction({}, new FormData());
  assert.match(result.error, /Google 로그인을 준비/);
});
function callback(auth) {
  return load('src/app/auth/callback/route.ts', {
    '@/lib/env': { env },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth }) },
    'next/server': { NextResponse: { redirect: (url) => Response.redirect(url) } },
  }).GET;
}
test('callback exchanges code and ignores even local user supplied next paths', async () => {
  const get = callback({ exchangeCodeForSession: async code => {
    assert.equal(code, 'pkce-code'); return { error: null };
  } });
  const response = await get(new Request('https://gobibi.art/auth/callback?code=pkce-code&next=/admin'));
  assert.equal(response.headers.get('location'), 'https://gobibi.art/dashboard');
});
test('callback cancellation never reflects arbitrary provider text', async () => {
  const response = await callback({})(new Request('https://gobibi.art/auth/callback?error=access_denied&error_description=SECRET'));
  assert.equal(response.headers.get('location'), 'https://gobibi.art/login?error=oauth_cancelled');
});
test('login UI shows Google, real password and disabled provider notice without a mock bypass', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  for (const mode of ['signin', 'signup']) {
    const Form = load('src/app/login/LoginForm.tsx', {
      '@/app/auth/actions': { signInAction: async () => ({}), signUpAction: async () => ({}), signInWithGoogleAction: async () => ({}) },
      '@/app/studio.module.css': new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }),
      react: { ...React, useState: () => [mode, () => {}], useActionState: () => [{ success: '확인 메일 요청 완료' }, () => {}, false] },
    }).default;
    const html = renderToStaticMarkup(React.createElement(Form, { authAvailable: true, googleEnabled: false }));
    assert.match(html, /Google로 계속하기/);
    assert.match(html, /Google 로그인을 준비/);
    assert.match(html, /type="password"/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /데모 모드/);
  }
});
test('real SSR client creates S256 PKCE challenge and writes verifier cookie', async () => {
  const jar = [];
  const { createSupabaseServerClient } = load('src/lib/supabase/server.ts', {
    '@/lib/env': { env, isSupabaseConfigured: true },
    'next/headers': { cookies: async () => ({ getAll: () => [], set: (name, value, options) => jar.push({ name, value, options }) }) },
  });
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: env.appUrl + '/auth/callback', skipBrowserRedirect: true } });
  assert.equal(error, null);
  const url = new URL(data.url);
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert.ok(url.searchParams.get('code_challenge'));
  assert.ok(jar.some(cookie => cookie.name.includes('code-verifier') && cookie.value));
});
test('Google settings require literal true and fail closed on transport and shape failures', async () => {
  const { isGoogleAuthEnabled } = load('src/lib/google-auth.ts', { '@/lib/env': { env, isSupabaseConfigured: true } });
  for (const value of [true, false, 'true', undefined]) {
    const enabled = await isGoogleAuthEnabled(async (url, options) => {
      assert.equal(String(url), 'https://auth.example/auth/v1/settings');
      assert.equal(options.headers.apikey, 'public-key');
      assert.equal(options.cache, 'no-store');
      return Response.json({ external: { google: value } });
    });
    assert.equal(enabled, value === true);
  }
  assert.equal(await isGoogleAuthEnabled(async () => { throw new Error('offline'); }), false);
  assert.equal(await isGoogleAuthEnabled(async () => new Response('', { status: 503 })), false);
  assert.equal(await isGoogleAuthEnabled(async () => Response.json(null)), false);
});
test('callback refuses expired codes, verifier errors, network errors and token-only URLs', async () => {
  for (const exchangeCodeForSession of [async () => ({ error: { message: 'PRIVATE' } }), async () => { throw new Error('PRIVATE'); }]) {
    const response = await callback({ exchangeCodeForSession })(new Request(env.appUrl + '/auth/callback?code=expired'));
    assert.equal(response.headers.get('location'), env.appUrl + '/login?error=auth_failed');
  }
  const response = await callback({})(new Request(env.appUrl + '/auth/callback?access_token=forged'));
  assert.equal(response.headers.get('location'), env.appUrl + '/login?error=auth_failed');
});
test('Google rejects missing URL, foreign redirect and provider errors', async () => {
  for (const result of [
    { data: { url: null }, error: null },
    { data: { url: 'https://evil.example/' }, error: null },
    { data: { url: null }, error: { code: 'provider_disabled', message: 'SECRET' } },
  ]) {
    const response = await actions({ signInWithOAuth: async () => result }).signInWithGoogleAction();
    assert.match(response.error, /Google 로그인을 준비/);
    assert.doesNotMatch(response.error, /SECRET/);
  }
});
test('immediate email sessions redirect outside catch, network failures stay Korean', async () => {
  await assert.rejects(actions({ signUp: async () => ({ data: { session: {} }, error: null }) }).signUpAction({}, credentials()), /REDIRECT:\/dashboard/);
  await assert.rejects(actions({ signInWithPassword: async () => ({ error: null }) }).signInAction({}, credentials()), /REDIRECT:\/dashboard/);
  const result = await actions({ signInWithPassword: async () => { throw new Error('SECRET'); } }).signInAction({}, credentials());
  assert.match(result.error, /연결하지 못/);
});
test('email error codes have safe Korean guidance', () => {
  const { authErrorMessage, authCallbackMessage } = load('src/lib/auth-messages.ts');
  for (const code of ['email_not_confirmed', 'user_already_exists', 'weak_password', 'email_address_invalid', 'email_address_not_authorized', 'over_email_send_rate_limit', 'over_request_rate_limit', 'signup_disabled', 'unexpected_failure']) {
    assert.match(authErrorMessage({ code, message: 'PRIVATE' }), /[가-힣]/);
    assert.doesNotMatch(authErrorMessage({ code, message: 'PRIVATE' }), /PRIVATE/);
  }
  assert.match(authErrorMessage({ status: 429 }), /요청이 너무 많/);
  assert.doesNotMatch(authCallbackMessage('injected text'), /injected/);
});
test('Google preserves trusted initiating alias rather than canonical env URL', async () => {
  const action = actions({ signInWithOAuth: async input => {
    assert.equal(input.options.redirectTo, 'https://books.ax4u.kr/auth/callback');
    return { data: { url: 'https://auth.example/auth/v1/authorize?provider=google' }, error: null };
  } }, true, true, 'https://books.ax4u.kr');
  await assert.rejects(action.signInWithGoogleAction(), /REDIRECT:https:/);
});
test('OAuth rejects untrusted initiation origin before creating a verifier', async () => {
  const result = await actions({}, true, true, 'https://evil.example').signInWithGoogleAction();
  assert.match(result.error, /로그인/);
});
test('callback stays on trusted alias so the host-only session cookie is usable', async () => {
  const response = await callback({ exchangeCodeForSession: async () => ({ error: null }) })(new Request('https://www.gobibi.art/auth/callback?code=pkce'));
  assert.equal(response.headers.get('location'), 'https://www.gobibi.art/dashboard');
});
test('email sign-in translates invalid credentials without exposing server details', async () => {
  const result = await actions({ signInWithPassword: async () => ({ error: { code: 'invalid_credentials', message: 'internal English details' } }) }).signInAction({}, credentials());
  assert.equal(result.error, '이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.');
});
test('signup confirmation is success, not an error, and uses fixed callback', async () => {
  const result = await actions({ signUp: async (input) => {
    assert.equal(input.email, 'reader@example.com');
    assert.equal(input.options.emailRedirectTo, 'https://gobibi.art/auth/callback');
    return { data: { session: null }, error: null };
  } }).signUpAction({}, credentials());
  assert.ok(result.success); assert.equal(result.error, undefined);
});
test('missing config fails closed instead of mock signin', async () => {
  const result = await actions({}, false).signInAction({}, credentials());
  assert.match(result.error, /준비/);
});
test('server rejects missing password without calling Supabase', async () => {
  const result = await actions({}).signInAction({}, credentials(''));
  assert.match(result.error, /비밀번호/);
});
