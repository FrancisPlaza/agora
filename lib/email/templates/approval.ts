/**
 * Pure renderer for the approval email. No I/O, no env vars — takes
 * the inputs, returns subject + preheader + HTML.
 *
 * The HTML chassis is a faithful copy of supabase/email-templates/
 * email-magic-link.html: same wordmark layout-table, same inlined
 * styles, same `<style>` block with @media rules for dark mode and
 * the 480px mobile breakpoint, same VML Outlook fallback for the
 * button. Only the body copy differs between this and the sign-in
 * template.
 *
 * Branches on the optional `topic` input:
 *   - present  → Variant A (voter): topic block in the body.
 *   - absent   → Variant B (non-voting admin): no topic block.
 */

interface TopicInfo {
  orderNum: number;
  philosopher: string;
  theme: string;
}

export interface ApprovalEmailInput {
  fullName: string;
  magicLinkUrl: string;
  topic?: TopicInfo;
}

export interface ApprovalEmailOutput {
  subject: string;
  preheader: string;
  html: string;
}

export function renderApprovalEmail(
  input: ApprovalEmailInput,
): ApprovalEmailOutput {
  const { fullName, magicLinkUrl, topic } = input;

  const subject = topic
    ? `Welcome, your topic is ${topic.philosopher}`
    : "Welcome to Agora";

  const preheader = topic
    ? "One tap to sign in. Your topic awaits."
    : "One tap to sign in.";

  const orderNumPadded = topic
    ? String(topic.orderNum).padStart(2, "0")
    : "";

  // Variant-specific body. Both variants share the wordmark, button,
  // URL fallback, disclaimer, and footer; only the lead paragraphs and
  // (Variant A) the emphasised topic block differ.
  const introHtml = topic
    ? `<p class="agora-text" style="margin:0 0 16px; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:16px; line-height:1.55; color:#1A1F36;">Your registration has been approved. You can now sign in to Agora — the class gallery, your draft ballot, and every topic detail page are open to you.</p>
            <p class="agora-text" style="margin:0 0 16px; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:16px; line-height:1.55; color:#1A1F36;">Your assigned topic is:</p>
            <p class="agora-text" style="margin:0 0 4px; font-family:'Source Serif 4', Georgia, 'Times New Roman', serif; font-weight:600; font-size:19px; line-height:1.4; color:#0A2540; letter-spacing:-0.01em;">Topic Nº ${orderNumPadded} — ${escapeHtml(topic.philosopher)}</p>
            <p class="agora-text-2" style="margin:0 0 16px; font-family:'Source Serif 4', Georgia, 'Times New Roman', serif; font-style:italic; font-size:14px; line-height:1.5; color:#64748B;">${escapeHtml(topic.theme)}</p>
            <p class="agora-text" style="margin:0 0 16px; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:16px; line-height:1.55; color:#1A1F36;">At any time before your presentation, sign in to upload your artwork and a short written explanation. Your artwork will only be visible to the class once you have presented. You can start drafting your ranked ballot any time as classmates present.</p>`
    : `<p class="agora-text" style="margin:0 0 16px; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:16px; line-height:1.55; color:#1A1F36;">Your registration has been approved as a non-voting admin. You have full access to the class gallery, every topic detail page, all class-shared notes, and the results page once voting completes.</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<!--[if mso]>
<style type="text/css">
  table, td, div, p, a { font-family: Arial, sans-serif !important; }
</style>
<![endif]-->
<style>
  @media (prefers-color-scheme: dark) {
    .agora-bg     { background-color: #0F172A !important; }
    .agora-card   { background-color: #0F172A !important; }
    .agora-text   { color: #E2E8F0 !important; }
    .agora-text-2 { color: #94A3B8 !important; }
    .agora-hair   { border-top-color: #1E293B !important; }
    .agora-mark   { background-color: #1E293B !important; }
    .agora-word   { color: #E2E8F0 !important; }
    .agora-link   { color: #8B85FF !important; }
  }
  @media (max-width: 480px) {
    .agora-pad   { padding-left: 24px !important; padding-right: 24px !important; }
    .agora-cta a { display: block !important; width: 100% !important; box-sizing: border-box !important; }
  }
</style>
</head>
<body class="agora-bg" style="margin:0; padding:0; background-color:#F6F9FC; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

<!-- Preheader (hidden) -->
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F6F9FC; opacity:0;">
  ${escapeHtml(preheader)}
</div>

<table role="presentation" class="agora-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F9FC;">
  <tr>
    <td align="center" style="padding:40px 12px;">

      <table role="presentation" class="agora-card" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background-color:#FFFFFF; border-radius:10px;">

        <!-- Wordmark -->
        <tr>
          <td class="agora-pad" style="padding:36px 40px 0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="agora-mark" width="24" height="24" align="center" valign="middle" bgcolor="#0A2540" style="background-color:#0A2540; width:24px; height:24px; border-radius:6px; font-family:'Source Serif 4', Georgia, 'Times New Roman', serif; font-weight:600; font-size:14px; line-height:24px; color:#FFFFFF; letter-spacing:-0.02em; text-align:center;">A</td>
                <td width="8" style="width:8px; font-size:0; line-height:0;">&nbsp;</td>
                <td class="agora-word" valign="middle" style="font-family:'Source Serif 4', Georgia, 'Times New Roman', serif; font-weight:600; font-size:20px; line-height:24px; color:#0A2540; letter-spacing:-0.015em;">Agora</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="agora-pad" style="padding:32px 40px 0 40px;">
            <p class="agora-text" style="margin:0 0 16px; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:16px; line-height:1.55; color:#1A1F36;">Hi ${escapeHtml(fullName)},</p>
            ${introHtml}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td class="agora-pad agora-cta" align="center" style="padding:24px 40px 8px 40px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${magicLinkUrl}" style="height:44px; v-text-anchor:middle; width:220px;" arcsize="18%" stroke="f" fillcolor="#5147E6">
              <w:anchorlock/>
              <center style="color:#FFFFFF; font-family:Arial, sans-serif; font-size:14px; font-weight:600; letter-spacing:0.01em;">Sign in to Agora</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${magicLinkUrl}" target="_blank" style="display:inline-block; background-color:#5147E6; color:#FFFFFF; text-decoration:none; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-weight:600; font-size:14px; line-height:20px; padding:12px 24px; border-radius:8px; letter-spacing:0.01em; mso-padding-alt:0;">Sign in to Agora</a>
            <!--<![endif]-->
          </td>
        </tr>

        <!-- URL fallback -->
        <tr>
          <td class="agora-pad" style="padding:16px 40px 0 40px;">
            <p class="agora-text-2" style="margin:0 0 6px; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:13px; line-height:1.55; color:#64748B;">Or paste this link into your browser:</p>
            <p style="margin:0; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:13px; line-height:1.55; word-break:break-all;">
              <a class="agora-link" href="${magicLinkUrl}" target="_blank" style="color:#5147E6; text-decoration:underline;">${magicLinkUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Disclaimer -->
        <tr>
          <td class="agora-pad" style="padding:24px 40px 0 40px;">
            <p class="agora-text-2" style="margin:0; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:14px; line-height:1.55; color:#64748B;">The link works once and expires in 60 minutes.</p>
          </td>
        </tr>

        <!-- Hairline + footer -->
        <tr>
          <td class="agora-pad" style="padding:32px 40px 36px 40px;">
            <div class="agora-hair" style="border-top:1px solid #E2E8F0; height:0; line-height:0; font-size:0;">&nbsp;</div>
            <p class="agora-text-2" style="margin:20px 0 0; font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size:12px; line-height:1.55; color:#64748B;">Agora · JDN101 Philosophy of Law · San Beda College Alabang School of Law</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;

  return { subject, preheader, html };
}

/** Minimal HTML-entity escape for user-controlled strings. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
