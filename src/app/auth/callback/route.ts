import { safeAuthNext } from "@/lib/auth-redirect";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/** Supabase auth redirect target — exchanges the OAuth/PKCE code for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = safeAuthNext(url.searchParams.get("next"));

  if (error) {
    return NextResponse.redirect(
      `${env.appUrl}/login?error=${encodeURIComponent(error)}`,
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        return NextResponse.redirect(
          `${env.appUrl}/login?error=${encodeURIComponent(exchangeError.message)}`,
        );
      }
      return NextResponse.redirect(new URL(next, env.appUrl));
    }
  }
  return NextResponse.redirect(
    `${env.appUrl}/login?error=${encodeURIComponent("인증 링크가 올바르지 않거나 만료되었습니다.")}`,
  );
}
