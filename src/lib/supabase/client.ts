"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

/** Browser-side Supabase client. Null in mock mode. */
export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured) return null;
  return createBrowserClient(env.supabaseUrl!, env.supabaseAnonKey!);
}
