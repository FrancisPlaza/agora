import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module mocks must be registered before imports of the system under
// test. Vitest hoists vi.mock calls to the top of the file.
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "@/lib/email/send";
import { dispatchApprovalEmail } from "./approval";

const mockedSendEmail = vi.mocked(sendEmail);

/**
 * Build a Supabase-client double that satisfies the methods
 * dispatchApprovalEmail uses: .from(table).select().eq().maybeSingle()
 * for reads and .from(table).insert() for the audit_log fallback. Each
 * call is recorded so the test can assert what was issued.
 */
function makeSupabaseStub(
  queryResults: Record<string, { data: unknown; error: { message: string } | null }>,
) {
  const calls: { type: "select" | "insert"; table: string; payload?: unknown }[] = [];

  const fromImpl = (table: string) => ({
    select() {
      return {
        eq() {
          return {
            async maybeSingle() {
              calls.push({ type: "select", table });
              const result = queryResults[table];
              return result ?? { data: null, error: { message: "no stub" } };
            },
          };
        },
      };
    },
    insert(payload: unknown) {
      calls.push({ type: "insert", table, payload });
      return Promise.resolve({ data: null, error: null });
    },
  });

  // The auth.admin.generateLink stub is configurable per test.
  const generateLink = vi.fn();

  return {
    client: {
      from: fromImpl,
      auth: { admin: { generateLink } },
    },
    calls,
    generateLink,
  };
}

beforeEach(() => {
  mockedSendEmail.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Happy path: voter with topic ──────────────────────────────────────

describe("dispatchApprovalEmail — voter with topic", () => {
  it("calls sendEmail once with the rendered subject + body", async () => {
    const stubs = makeSupabaseStub({
      profiles: {
        data: { email: "voter@example.com", full_name: "Maria Santos" },
        error: null,
      },
      topics: {
        data: { order_num: 5, philosopher: "Thomas Hobbes", theme: "Legalism" },
        error: null,
      },
    });
    stubs.generateLink.mockResolvedValue({
      data: { properties: { action_link: "https://link.example/abc" } },
      error: null,
    });
    mockedSendEmail.mockResolvedValue({ ok: true, id: "test-id" });

    await dispatchApprovalEmail({
      // @ts-expect-error — narrow shape for testing.
      supabase: stubs.client,
      // @ts-expect-error — narrow shape for testing.
      supabaseAdmin: stubs.client,
      targetId: "11111111-1111-1111-1111-111111111111",
      topicId: 5,
      actorId: "22222222-2222-2222-2222-222222222222",
      siteUrl: "https://agora.plaza.ph",
    });

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.to).toBe("voter@example.com");
    expect(call.subject).toBe("Welcome, your topic is Thomas Hobbes");
    expect(call.html).toContain("Maria Santos");
    expect(call.html).toContain("Topic Nº 05");
    expect(call.html).toContain("Legalism");
    expect(call.html).toContain("https://link.example/abc");

    expect(stubs.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "voter@example.com",
      options: { redirectTo: "https://agora.plaza.ph/auth/callback" },
    });

    // No audit_log row written on the happy path.
    const audits = stubs.calls.filter(
      (c) => c.type === "insert" && c.table === "audit_log",
    );
    expect(audits).toHaveLength(0);
  });
});

// ── Happy path: non-voting admin ──────────────────────────────────────

describe("dispatchApprovalEmail — non-voting admin (no topic)", () => {
  it("skips the topic fetch and sends Variant B", async () => {
    const stubs = makeSupabaseStub({
      profiles: {
        data: { email: "prof@example.com", full_name: "Marlon Tronqued" },
        error: null,
      },
    });
    stubs.generateLink.mockResolvedValue({
      data: { properties: { action_link: "https://link.example/xyz" } },
      error: null,
    });
    mockedSendEmail.mockResolvedValue({ ok: true, id: "test-id" });

    await dispatchApprovalEmail({
      // @ts-expect-error — narrow shape for testing.
      supabase: stubs.client,
      // @ts-expect-error — narrow shape for testing.
      supabaseAdmin: stubs.client,
      targetId: "11111111-1111-1111-1111-111111111111",
      topicId: null,
      actorId: "22222222-2222-2222-2222-222222222222",
      siteUrl: "https://agora.plaza.ph",
    });

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.subject).toBe("Welcome to Agora");
    expect(call.html).not.toContain("Topic Nº");

    // Confirm we did NOT query the topics table.
    const topicQueries = stubs.calls.filter(
      (c) => c.type === "select" && c.table === "topics",
    );
    expect(topicQueries).toHaveLength(0);
  });
});

// ── Failure paths: never throw, write audit row ──────────────────────

describe("dispatchApprovalEmail — failure handling", () => {
  it("does not throw when sendEmail fails, and writes an audit row", async () => {
    const stubs = makeSupabaseStub({
      profiles: {
        data: { email: "v@example.com", full_name: "V" },
        error: null,
      },
      topics: {
        data: { order_num: 1, philosopher: "X", theme: "Y" },
        error: null,
      },
    });
    stubs.generateLink.mockResolvedValue({
      data: { properties: { action_link: "https://link.example/abc" } },
      error: null,
    });
    mockedSendEmail.mockResolvedValue({ ok: false, error: "Resend down" });

    await expect(
      dispatchApprovalEmail({
        // @ts-expect-error — narrow shape for testing.
        supabase: stubs.client,
        // @ts-expect-error — narrow shape for testing.
        supabaseAdmin: stubs.client,
        targetId: "11111111-1111-1111-1111-111111111111",
        topicId: 1,
        actorId: "22222222-2222-2222-2222-222222222222",
        siteUrl: "https://agora.plaza.ph",
      }),
    ).resolves.toBeUndefined();

    const audits = stubs.calls.filter(
      (c) => c.type === "insert" && c.table === "audit_log",
    );
    expect(audits).toHaveLength(1);
    const meta = (audits[0].payload as { meta: { error: string } }).meta;
    expect(meta.error).toContain("Resend down");
  });

  it("does not throw when generateLink fails", async () => {
    const stubs = makeSupabaseStub({
      profiles: {
        data: { email: "v@example.com", full_name: "V" },
        error: null,
      },
    });
    stubs.generateLink.mockResolvedValue({
      data: null,
      error: { message: "rate limited" },
    });

    await expect(
      dispatchApprovalEmail({
        // @ts-expect-error — narrow shape for testing.
        supabase: stubs.client,
        // @ts-expect-error — narrow shape for testing.
        supabaseAdmin: stubs.client,
        targetId: "11111111-1111-1111-1111-111111111111",
        topicId: null,
        actorId: "22222222-2222-2222-2222-222222222222",
        siteUrl: "https://agora.plaza.ph",
      }),
    ).resolves.toBeUndefined();

    expect(mockedSendEmail).not.toHaveBeenCalled();
    const audits = stubs.calls.filter(
      (c) => c.type === "insert" && c.table === "audit_log",
    );
    expect(audits).toHaveLength(1);
  });
});
