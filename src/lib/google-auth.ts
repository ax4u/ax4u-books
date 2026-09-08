import { env, isSupabaseConfigured } from "@/lib/env";

/** Public GoTrue settings: no admin key, new env flag, or remote config write. */
export async function isGoogleAuthEnabled(fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const response = await fetcher(new URL("/auth/v1/settings", env.supabaseUrl!), {
      headers: { apikey: env.supabaseAnonKey! },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}
