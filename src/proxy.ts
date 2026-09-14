import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Next.js 16 renamed `middleware` to `proxy`. This runs before routes render and
 * refreshes the Supabase auth session cookie. In mock mode it's a no-op.
 */
function isWithdrawnPath(pathname: string) {
  try {
    // Normalize encoded paths before testing both static and API entry points.
    for (let i = 0; i < 3; i++) pathname = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return /^\/(?:exhibition|api\/exhibition|books|api\/books)\/planet-friends(?:\/|$)/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  let withdrawn = isWithdrawnPath(pathname);
  if (pathname === "/_next/image") {
    try {
      withdrawn ||= isWithdrawnPath(new URL(searchParams.get("url") ?? "", request.url).pathname);
    } catch {
      withdrawn = true;
    }
  }
  if (withdrawn) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
    });
  }

  const response = NextResponse.next({ request });
  // These paths were previously excluded from auth-session refresh.
  if (pathname === "/_next/image" || /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(pathname)) return response;

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the session so it refreshes if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/exhibition/:path*",
    "/api/exhibition/:path*",
    "/api/books/planet-friends/:path*",
    "/_next/image",
    "/((?!_next/static|_next/image|favicon.ico|api/books/[^/]+/(?:cover|assets/[^/]+)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
