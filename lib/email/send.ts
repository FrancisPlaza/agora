import { Resend } from "resend";

/**
 * Thin wrapper around Resend's transactional email API.
 *
 * Contract: this function never throws. Email failures are surfaced
 * through the discriminated return type so callers can decide whether
 * the failure should fail their flow. For the approval-email use case
 * the failure is non-blocking — the DB approval already succeeded;
 * the email is best-effort and recorded to audit_log on failure.
 *
 * Both env vars (RESEND_API_KEY, EMAIL_FROM) are read at call time.
 * If either is missing — common in local dev / preview environments —
 * the call returns `{ ok: false, error: "Email provider not configured" }`
 * without making a network request. Tests run green without real keys.
 */

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { ok: false, error: "Email provider not configured" };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    // Defensive: Resend's SDK shouldn't throw, but a network/transport
    // error could surface as a thrown exception. Translate to the
    // discriminated-failure shape so the caller never has to try/catch.
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
