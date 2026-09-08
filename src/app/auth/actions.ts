"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { trustedAuthOrigin } from "@/lib/auth-origin";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mockSignOut } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { AUTH_UNAVAILABLE, GOOGLE_UNAVAILABLE, authErrorMessage } from "@/lib/auth-messages";

export type AuthState = { error?: string; success?: string };

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

async function emailAuth(formData: FormData, signup: boolean): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email) return { error: "이메일을 입력해 주세요." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "올바른 이메일 주소를 입력해 주세요." };
  if (!password) return { error: "비밀번호를 입력해 주세요." };
  if (signup && password.length < 6) return { error: "비밀번호는 6자 이상 입력해 주세요." };
  if (!isSupabaseConfigured) return { error: AUTH_UNAVAILABLE };

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: AUTH_UNAVAILABLE };
    if (signup) {
      const origin = trustedAuthOrigin((await headers()).get("origin"));
      if (!origin) return { error: AUTH_UNAVAILABLE };
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: new URL("/auth/callback", origin).href },
      });
      if (error) return { error: authErrorMessage(error) };
      if (!data.session) return { success: "가입 확인 메일을 요청했어요. 받은편지함과 스팸함의 링크로 인증을 완료해 주세요. 이미 가입했다면 로그인해 주세요." };
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: authErrorMessage(error) };
    }
  } catch {
    return { error: "인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // Next redirect throws; never catch it as an auth/network error.
  redirect("/dashboard");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  return emailAuth(formData, false);
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  return emailAuth(formData, true);
}

export async function signInWithGoogleAction(): Promise<AuthState> {
  if (!(await isGoogleAuthEnabled())) return { error: GOOGLE_UNAVAILABLE };
  let target: string;
  try {
    const origin = trustedAuthOrigin((await headers()).get("origin"));
    if (!origin) return { error: GOOGLE_UNAVAILABLE };
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: AUTH_UNAVAILABLE };
    // @supabase/ssr stores the PKCE verifier in cookies; the callback must use
    // the same cookie-backed client to exchange the code, not trust URL tokens.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("/auth/callback", origin).href,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: authErrorMessage(error) };
    if (!data.url) return { error: GOOGLE_UNAVAILABLE };
    const url = new URL(data.url);
    if (url.origin !== new URL(env.supabaseUrl!).origin || url.pathname !== "/auth/v1/authorize") {
      return { error: GOOGLE_UNAVAILABLE };
    }
    target = url.href;
  } catch {
    return { error: GOOGLE_UNAVAILABLE };
  }
  redirect(target);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase!.auth.signOut();
  } else {
    await mockSignOut();
  }
  redirect("/");
}
