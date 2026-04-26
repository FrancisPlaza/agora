import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Database } from "./supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Returns the current Supabase auth user or `null`. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Returns the current user's full profile row, or `null` if not signed in.
 * Reads through RLS — the `profiles_self_read` policy permits this regardless
 * of `status`, so it works for `pending_email` users too.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Server-component guard. Redirects away unless the caller is approved.
 * Middleware should already have done this — this is a defensive backstop
 * for code paths that touch approved-only data.
 */
export async function requireApproved(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  switch (profile.status) {
    case "approved":
      return profile;
    case "pending_email":
      redirect("/awaiting-email");
    case "pending_approval":
      redirect("/awaiting-approval");
    case "rejected":
      redirect("/rejected");
    default:
      redirect("/");
  }
}
