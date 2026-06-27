"use client";

import { createBrowserClient } from "@supabase/ssr";

// NOTE: In the browser, Next only inlines *literal* `process.env.NEXT_PUBLIC_*`
// references (not the dynamic helper used in env.ts), so read them directly here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Browser-side Supabase client. Null in mock mode (no public keys). */
export function createSupabaseBrowserClient() {
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}
