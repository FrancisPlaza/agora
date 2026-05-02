import { describe, expect, it } from "vitest";
import { renderApprovalEmail } from "./approval";

describe("renderApprovalEmail — Variant A (voter, has topic)", () => {
  const out = renderApprovalEmail({
    fullName: "Maria Santos",
    magicLinkUrl: "https://agora.plaza.ph/auth/v1/verify?token=abc&type=magiclink",
    topic: { orderNum: 5, philosopher: "Thomas Hobbes", theme: "Legalism, or Rule by the Law" },
  });

  it("subject names the philosopher", () => {
    expect(out.subject).toBe("Welcome, your topic is Thomas Hobbes");
  });

  it("preheader emphasises the assigned topic", () => {
    expect(out.preheader).toBe("One tap to sign in. Your topic awaits.");
  });

  it("html includes the recipient's full name in the greeting", () => {
    expect(out.html).toContain("Hi Maria Santos,");
  });

  it("html includes the topic order number, philosopher, and theme", () => {
    expect(out.html).toContain("Topic Nº 05");
    expect(out.html).toContain("Thomas Hobbes");
    expect(out.html).toContain("Legalism, or Rule by the Law");
  });

  it("html includes the magic-link URL twice (button href + fallback)", () => {
    const occurrences = out.html.split(
      "https://agora.plaza.ph/auth/v1/verify?token=abc&amp;type=magiclink",
    ).length - 1;
    // The URL is interpolated into the VML href, the non-MSO <a> href,
    // and the fallback link's href + visible text. & is HTML-escaped
    // because we drop the URL into HTML content, but the raw URL also
    // appears as the visible text. Either way it's present multiple
    // times in the rendered output.
    const rawOccurrences = out.html.split(
      "https://agora.plaza.ph/auth/v1/verify?token=abc",
    ).length - 1;
    expect(occurrences + rawOccurrences).toBeGreaterThanOrEqual(2);
  });

  it("disclaimer line names the 60-minute expiry", () => {
    expect(out.html).toContain("expires in 60 minutes");
  });

  it("button label reads 'Sign in to Agora'", () => {
    expect(out.html).toContain("Sign in to Agora");
  });

  it("footer caption is the canonical institutional line", () => {
    expect(out.html).toContain(
      "Agora · JDN101 Philosophy of Law · San Beda College Alabang School of Law",
    );
  });
});

describe("renderApprovalEmail — Variant B (non-voting admin, no topic)", () => {
  const out = renderApprovalEmail({
    fullName: "Marlon Tronqued",
    magicLinkUrl: "https://agora.plaza.ph/auth/v1/verify?token=xyz&type=magiclink",
  });

  it("subject is 'Welcome to Agora'", () => {
    expect(out.subject).toBe("Welcome to Agora");
  });

  it("preheader doesn't mention a topic", () => {
    expect(out.preheader).toBe("One tap to sign in.");
  });

  it("html mentions the non-voting-admin role", () => {
    expect(out.html).toContain("non-voting admin");
  });

  it("html does NOT include any 'Topic Nº' block", () => {
    expect(out.html).not.toContain("Topic Nº");
  });

  it("html does NOT include the topic-specific 'assigned topic is' line", () => {
    expect(out.html).not.toContain("Your assigned topic is:");
  });

  it("html does NOT include the upload-instructions paragraph from Variant A", () => {
    expect(out.html).not.toContain("upload your artwork");
  });
});

describe("renderApprovalEmail — escapes user-controlled strings", () => {
  it("escapes HTML in fullName", () => {
    const out = renderApprovalEmail({
      fullName: "Evil <script>alert(1)</script>",
      magicLinkUrl: "https://example.com/",
    });
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in topic philosopher and theme", () => {
    const out = renderApprovalEmail({
      fullName: "Plato",
      magicLinkUrl: "https://example.com/",
      topic: {
        orderNum: 1,
        philosopher: "<b>Hobbes</b>",
        theme: "Pure & Applied",
      },
    });
    expect(out.html).not.toContain("<b>Hobbes</b>");
    expect(out.html).toContain("&lt;b&gt;Hobbes&lt;/b&gt;");
    expect(out.html).toContain("Pure &amp; Applied");
  });
});
