"use server";

import { updateProfileName } from "@/lib/actions/profile";

export interface FormState {
  error?: string;
  saved?: boolean;
}

export async function updateNameAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const fullName = String(formData.get("fullName") ?? "");
  const result = await updateProfileName(fullName);
  if (result.error) return { error: result.error };
  return { saved: true };
}
