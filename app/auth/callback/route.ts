import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATUS_REDIRECT: Record<string, string> = {
  pending_email: "/awaiting-email",
  pending_approval: "/awaiting-approval",
  approved: "/dashboard",
  rejected: "/rejected",
};

/**
 * Magic-link callback. Exchanges the `?code=…` for a session, then redirects
 * the user straight to the screen their `profiles.status` puts them on.
 * Middleware would catch a wrong destination too — eager redirect just saves
 * a hop.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = await createClient();
  const tExchange = Date.now();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  console.log(`[perf] callback.exchangeCode ${Date.now() - tExchange}ms`);
  if (error) {
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  const tUser = Date.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log(`[perf] callback.getUser ${Date.now() - tUser}ms`);
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const tProfile = Date.now();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  console.log(`[perf] callback.profile ${Date.now() - tProfile}ms`);

  // Surface DB-side failures (RLS, missing grants, dropped FK) instead
  // of silently treating them as a missing profile. The fallback to
  // pending_email below stays as a defensive default, but Vercel logs
  // will now show why a real user is being bounced.
  if (profileErr) {
    console.error(
      `[auth/callback] profile fetch failed for ${user.id}: ${profileErr.message} (code: ${profileErr.code})`,
    );
  }

  const dest = STATUS_REDIRECT[profile?.status ?? "pending_email"] ?? "/";
  return NextResponse.redirect(new URL(dest, request.url));
}
