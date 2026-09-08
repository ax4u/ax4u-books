import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trustedAuthOrigin } from "@/lib/auth-origin";

/** Exchange only PKCE codes with the browser's verifier cookie. Never trust
 * request Host, next, access_token, or provider error_description parameters. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = trustedAuthOrigin(requestUrl.origin);
  if (!origin) return NextResponse.redirect("https://gobibi.art/login?error=auth_failed");
  const params = requestUrl.searchParams;
  const failure = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  if (params.has("error") || params.has("error_description")) {
    return failure(params.get("error") === "access_denied" ? "oauth_cancelled" : "auth_failed");
  }
  const code = params.get("code");
  if (!code) return failure("auth_failed");
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return failure("auth_unavailable");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure("auth_failed");
  } catch {
    return failure("auth_failed");
  }
  return NextResponse.redirect(new URL("/dashboard", origin));
}
