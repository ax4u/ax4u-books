import { cookies } from "next/headers";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type SessionUser = {
  id: string;
  email: string;
};

const MOCK_COOKIE = "mock_user_email";

/** Deterministic UUID-ish id from an email so mock data is stable per user. */
function mockUserId(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (Math.imul(31, h) + email.charCodeAt(i)) | 0;
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${hex.padStart(12, "0")}`;
}

/** Current signed-in user, or null. Works in both Supabase and mock mode. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase!.auth.getUser();
    if (!data.user || !data.user.email) return null;
    return { id: data.user.id, email: data.user.email };
  }

  // Mock mode: a signed cookie holding the demo email.
  const cookieStore = await cookies();
  const email = cookieStore.get(MOCK_COOKIE)?.value;
  if (!email) return null;
  return { id: mockUserId(email), email };
});

/** Mock-mode sign-in: just remember the email in a cookie. */
export async function mockSignIn(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MOCK_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function mockSignOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MOCK_COOKIE);
}
