"use server";

import { redirect } from "next/navigation";
import { register } from "@/lib/actions/auth";

export interface FormState {
  error?: string;
  values?: { fullName: string; email: string; studentId: string };
}

export async function registerAction(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const studentId = String(formData.get("studentId") ?? "");

  const result = await register({ fullName, email, studentId });
  if (result.error) {
    return { error: result.error, values: { fullName, email, studentId } };
  }

  redirect("/awaiting-email");
}
