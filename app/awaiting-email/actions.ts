"use server";

import { redirect } from "next/navigation";
import { resendConfirmation } from "@/lib/actions/auth";

export async function resendAction(): Promise<void> {
  const result = await resendConfirmation();
  if (result.error) {
    redirect(`/awaiting-email?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/awaiting-email?resent=1");
}
