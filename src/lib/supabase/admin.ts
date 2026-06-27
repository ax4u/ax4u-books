import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseAdminConfigured } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS — only use on the server (webhook
 * handlers, generation jobs). Null when the service role key is not set.
 */
export function createSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured) return null;
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
