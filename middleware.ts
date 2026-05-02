import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Paths an unauthenticated user is allowed to land on. `/awaiting-email`
// is included because the post-register "check your inbox" view runs in
// the gap between submitting the form and clicking the magic link, when
// the user has no session yet.
const PUBLIC_PATHS = new Set(["/", "/register", "/signin", "/awaiting-email"]);

const STATUS_GATE: Record<string, string> = {
  pending_email: "/awaiting-email",
  pending_approval: "/awaiting-approval",
  rejected: "/rejected",
};

const STATUS_PATHS = new Set(Object.values(STATUS_GATE));

/**
 * Single source of truth for routing redirects:
 *   - refreshes the Supabase session on every request
 *   - reads `profiles.status` for the current user
 *   - redirects per the routing table in specs/phase-2-prompt.md
 *
 * Layouts trust the middleware; they don't duplicate the redirect logic.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Cast for the same `@supabase/ssr` ↔ `@supabase/supabase-js` generic
  // mismatch documented in `lib/supabase/server.ts`.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      } satisfies CookieMethodsServer,
    },
  ) as unknown as SupabaseClient<Database>;

  const { pathname } = request.nextUrl;

  const tUser = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log(
    `[perf] middleware.getUser ${pathname} ${Date.now() - tUser}ms`,
  );

  // The magic-link callback always passes through; it manages its own redirect.
  if (pathname.startsWith("/auth/")) return response;

  if (!user) {
    if (PUBLIC_PATHS.has(pathname)) return response;
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Authenticated. Look up status + admin flag to gate.
  const tProfile = Date.now();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("status, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  console.log(
    `[perf] middleware.profile ${pathname} ${Date.now() - tProfile}ms`,
  );

  // Surface DB-side failures (RLS, missing grants, dropped FK) instead
  // of silently treating them as a missing profile. The fallback to
  // pending_email below stays as a defensive default, but Vercel logs
  // will now show why a real user is being bounced.
  if (profileErr) {
    console.error(
      `[middleware] profile fetch failed for ${user.id}: ${profileErr.message} (code: ${profileErr.code})`,
    );
  }

  const status = profile?.status ?? "pending_email";
  const isAdmin = profile?.is_admin ?? false;

  // Authed users never see register / signin.
  if (pathname === "/register" || pathname === "/signin") {
    const dest =
      status === "approved" ? "/dashboard" : (STATUS_GATE[status] ?? "/");
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Admin gate — must be approved AND is_admin to enter /admin/*.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (status !== "approved" || !isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (status === "approved") {
    // Approved users can't sit on the awaiting-/rejected screens or the landing.
    if (STATUS_PATHS.has(pathname) || pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // Non-approved authed users: pinned to their status gate.
  const expected = STATUS_GATE[status];
  if (!expected) return NextResponse.redirect(new URL("/", request.url));
  if (pathname === expected) return response;
  return NextResponse.redirect(new URL(expected, request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *   - _next/static, _next/image (Next assets)
     *   - favicon.ico
     *   - any file with an image extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
