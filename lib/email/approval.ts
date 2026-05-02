import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sendEmail } from "@/lib/email/send";
import { renderApprovalEmail } from "@/lib/email/templates/approval";

/**
 * Post-approval orchestration: generate a magic link, fetch the
 * approved profile and (if applicable) the assigned topic, render the
 * approval email, and send it via Resend.
 *
 * Failure of any step (link generation, query, send) is non-blocking.
 * The DB approval already succeeded by the time this is called; the
 * email is best-effort. On failure we log via console.error and write
 * a row to audit_log via the admin client so the beadle can see what
 * went wrong without digging through Vercel logs.
 *
 * Exported for testing — the action layer just calls this and ignores
 * the return value (it's `void` because the action shouldn't branch
 * on email outcome).
 */
export async function dispatchApprovalEmail(input: {
  supabase: SupabaseClient<Database>;
  supabaseAdmin: SupabaseClient<Database>;
  targetId: string;
  topicId: number | null;
  actorId: string;
  siteUrl: string;
}): Promise<void> {
  const { supabase, supabaseAdmin, targetId, topicId, actorId, siteUrl } = input;

  try {
    // 1. Profile (email, full_name).
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", targetId)
      .maybeSingle();
    if (profileErr || !profile) {
      await recordFailure(
        supabaseAdmin,
        actorId,
        targetId,
        `profile fetch failed: ${profileErr?.message ?? "not found"}`,
      );
      return;
    }

    // 2. Topic info if a topic was assigned.
    let topic: { orderNum: number; philosopher: string; theme: string } | undefined;
    if (topicId !== null) {
      const { data: topicRow, error: topicErr } = await supabase
        .from("topics")
        .select("order_num, philosopher, theme")
        .eq("id", topicId)
        .maybeSingle();
      if (topicErr || !topicRow) {
        await recordFailure(
          supabaseAdmin,
          actorId,
          targetId,
          `topic fetch failed: ${topicErr?.message ?? "not found"}`,
        );
        return;
      }
      topic = {
        orderNum: topicRow.order_num,
        philosopher: topicRow.philosopher,
        theme: topicRow.theme,
      };
    }

    // 3. Magic link (admin API — needs service-role privileges).
    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
        options: { redirectTo: `${siteUrl}/auth/callback` },
      });
    if (linkErr || !linkData?.properties?.action_link) {
      await recordFailure(
        supabaseAdmin,
        actorId,
        targetId,
        `generateLink failed: ${linkErr?.message ?? "no action_link in response"}`,
      );
      return;
    }

    // 4. Render + send.
    const rendered = renderApprovalEmail({
      fullName: profile.full_name,
      magicLinkUrl: linkData.properties.action_link,
      topic,
    });
    const result = await sendEmail({
      to: profile.email,
      subject: rendered.subject,
      html: rendered.html,
    });

    if (!result.ok) {
      await recordFailure(
        supabaseAdmin,
        actorId,
        targetId,
        `sendEmail failed: ${result.error}`,
      );
      return;
    }
  } catch (err) {
    // Defensive — anything thrown that isn't already caught above.
    const message = err instanceof Error ? err.message : String(err);
    await recordFailure(
      supabaseAdmin,
      actorId,
      targetId,
      `unexpected: ${message}`,
    );
  }
}

async function recordFailure(
  supabaseAdmin: SupabaseClient<Database>,
  actorId: string,
  targetId: string,
  message: string,
): Promise<void> {
  console.error(`[approval-email] ${targetId}: ${message}`);
  // Best-effort audit row. If even the audit insert fails, swallow —
  // the console.error above is the floor.
  try {
    await supabaseAdmin.from("audit_log").insert({
      actor_id: actorId,
      action: "approval_email_failed",
      target_type: "profile",
      target_id: targetId,
      meta: { error: message },
    });
  } catch {
    // intentional
  }
}
