"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterInput {
  fullName: string;
  email: string;
  studentId: string;
}

/**
 * Send a magic link to a new user. The Supabase trigger `handle_new_user`
 * creates a `profiles` row from the `options.data` metadata. Snake_case keys
 * (`full_name`, `student_id`) are intentional — the trigger reads them.
 */
export async function register(
  input: RegisterInput,
): Promise<{ error?: string }> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const studentId = input.studentId.trim();

  if (!fullName) return { error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!studentId) return { error: "Please enter your student ID." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        full_name: fullName,
        student_id: studentId,
      },
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return {};
}

/**
 * Send a magic link to an existing user. `shouldCreateUser: false` means
 * Supabase returns an "Otp not allowed for this user" / "User not found"
 * shape if the email isn't registered — surfaced as a friendlier message.
 */
export async function signIn(email: string): Promise<{ error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });

  if (error) {
    // Supabase returns various messages for "no such user". Normalise.
    if (/sign ?ups? not allowed|user not found/i.test(error.message)) {
      return { error: "No account with that email. Try registering instead." };
    }
    return { error: error.message };
  }
  return {};
}

/** Resend the magic link to the currently-signed-in user (used on /awaiting-email). */
export async function resendConfirmation(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "No active session." };

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return {};
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}
