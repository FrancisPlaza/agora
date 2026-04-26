"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Update the current user's display name. RLS (`profiles_self_update`)
 * limits the row to the caller's own; no service-role required.
 */
export async function updateProfileName(
  fullName: string,
): Promise<{ error?: string }> {
  const trimmed = fullName.trim();
  if (!trimmed) return { error: "Name cannot be empty." };
  if (trimmed.length > 120) return { error: "Name is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return {};
}
