"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/actions/auth";

export interface FormState {
  error?: string;
  values?: { email: string };
}

export async function signInAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");

  const result = await signIn(email);
  if (result.error) {
    return { error: result.error, values: { email } };
  }

  redirect(`/signin?sent=1&email=${encodeURIComponent(email)}`);
}
