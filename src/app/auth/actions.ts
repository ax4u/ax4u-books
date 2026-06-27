"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mockSignIn, mockSignOut } from "@/lib/auth";

export type AuthState = { error?: string };

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email) return { error: "이메일을 입력해 주세요." };

  if (!isSupabaseConfigured) {
    await mockSignIn(email);
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email) return { error: "이메일을 입력해 주세요." };

  if (!isSupabaseConfigured) {
    await mockSignIn(email);
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) return { error: error.message };
  // If email confirmation is disabled, a session is returned immediately.
  if (data.session) redirect("/dashboard");
  return { error: "확인 메일을 보냈어요. 메일의 링크를 눌러 인증을 완료해 주세요." };
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
