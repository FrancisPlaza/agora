import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module mocks before importing the system under test.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteVoter } from "./admin";

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateServiceClient = vi.mocked(createServiceClient);

interface CallerProfile {
  id: string;
  is_admin: boolean;
  status: string;
}

interface TargetProfile {
  id: string;
  email: string;
  full_name: string;
  student_id: string;
  is_admin: boolean;
  topics:
    | { id: number; presented_at: string | null; art_image_path: string | null }
    | null;
  ballots: { submitted_at: string | null } | null;
}

interface SetupOptions {
  user?: { id: string } | null;
  callerProfile?: CallerProfile | null;
  targetProfile?: TargetProfile | null;
  storageObjects?: Array<{ name: string }>;
  deleteUserError?: { message: string } | null;
}

function makeStubs(setup: SetupOptions) {
  const calls: Array<{ kind: string; payload?: unknown }> = [];
  let profileSelectIndex = 0;

  const profileBuilder = {
    select() {
      return {
        eq() {
          return {
            async maybeSingle() {
              const idx = profileSelectIndex++;
              calls.push({ kind: `profiles.select#${idx}` });
              if (idx === 0) {
                return { data: setup.callerProfile ?? null, error: null };
              }
              return { data: setup.targetProfile ?? null, error: null };
            },
          };
        },
      };
    },
  };

  const auditBuilder = {
    async insert(payload: unknown) {
      calls.push({ kind: "audit_log.insert", payload });
      return { data: null, error: null };
    },
  };

  const fromImpl = (table: string) => {
    if (table === "profiles") return profileBuilder;
    if (table === "audit_log") return auditBuilder;
    throw new Error(`unexpected from(${table})`);
  };

  const storageBucket = {
    async list(prefix: string) {
      calls.push({ kind: "storage.list", payload: prefix });
      return { data: setup.storageObjects ?? [], error: null };
    },
    async remove(paths: string[]) {
      calls.push({ kind: "storage.remove", payload: paths });
      return { data: null, error: null };
    },
  };

  const deleteUser = vi.fn(async (id: string) => {
    calls.push({ kind: "deleteUser", payload: id });
    return { data: null, error: setup.deleteUserError ?? null };
  });

  const supabase = {
    auth: {
      async getUser() {
        return { data: { user: setup.user ?? null }, error: null };
      },
    },
    from: fromImpl,
  };

  const supabaseAdmin = {
    from: fromImpl,
    storage: { from: () => storageBucket },
    auth: { admin: { deleteUser } },
  };

  return { supabase, supabaseAdmin, calls, deleteUser };
}

beforeEach(() => {
  mockedCreateClient.mockReset();
  mockedCreateServiceClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const TARGET_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "22222222-2222-2222-2222-222222222222";

function approvedAdmin(id = ADMIN_ID): CallerProfile {
  return { id, is_admin: true, status: "approved" };
}

function eligibleTarget(
  overrides: Partial<TargetProfile> = {},
): TargetProfile {
  return {
    id: TARGET_ID,
    email: "voter@example.com",
    full_name: "Maria Santos",
    student_id: "2025000999",
    is_admin: false,
    topics: { id: 5, presented_at: null, art_image_path: "5/artwork.png" },
    ballots: null,
    ...overrides,
  };
}

// ── Auth check ─────────────────────────────────────────────────────────

describe("deleteVoter — auth", () => {
  it("returns NOT_AUTHORISED when there is no signed-in user", async () => {
    const stubs = makeStubs({ user: null });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "NOT_AUTHORISED" });
    expect(stubs.deleteUser).not.toHaveBeenCalled();
  });

  it("returns NOT_AUTHORISED when caller is not an admin", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: { id: ADMIN_ID, is_admin: false, status: "approved" },
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "NOT_AUTHORISED" });
    expect(stubs.deleteUser).not.toHaveBeenCalled();
  });

  it("returns NOT_AUTHORISED when caller is admin but not approved", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: {
        id: ADMIN_ID,
        is_admin: true,
        status: "pending_approval",
      },
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "NOT_AUTHORISED" });
  });
});

// ── Validation ─────────────────────────────────────────────────────────

describe("deleteVoter — validation", () => {
  it("returns NOT_FOUND when target profile doesn't exist", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: null,
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(stubs.deleteUser).not.toHaveBeenCalled();
  });

  it("returns ALREADY_PRESENTED when target's topic has presented_at set", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: eligibleTarget({
        topics: {
          id: 5,
          presented_at: "2026-04-15T10:00:00Z",
          art_image_path: null,
        },
      }),
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "ALREADY_PRESENTED" });
    expect(stubs.deleteUser).not.toHaveBeenCalled();
  });

  it("returns BALLOT_SUBMITTED when target has a submitted ballot", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: eligibleTarget({
        ballots: { submitted_at: "2026-05-01T12:00:00Z" },
      }),
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "BALLOT_SUBMITTED" });
    expect(stubs.deleteUser).not.toHaveBeenCalled();
  });
});

// ── Happy paths ────────────────────────────────────────────────────────

describe("deleteVoter — happy paths", () => {
  it("voter with assigned topic: cleans storage, audits, deletes", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: eligibleTarget(),
      storageObjects: [{ name: "artwork.png" }, { name: "scratch.tmp" }],
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: true });

    const kinds = stubs.calls.map((c) => c.kind);
    expect(kinds).toContain("storage.list");
    expect(kinds).toContain("storage.remove");
    expect(kinds).toContain("audit_log.insert");
    expect(kinds).toContain("deleteUser");

    // Storage list/remove called against the topic's prefix.
    const listCall = stubs.calls.find((c) => c.kind === "storage.list");
    expect(listCall?.payload).toBe("5/");
    const removeCall = stubs.calls.find((c) => c.kind === "storage.remove");
    expect(removeCall?.payload).toEqual(["5/artwork.png", "5/scratch.tmp"]);

    // Audit row carries the captured identity + topic id.
    const auditCall = stubs.calls.find((c) => c.kind === "audit_log.insert");
    const audit = auditCall?.payload as {
      actor_id: string;
      action: string;
      target_id: string;
      meta: Record<string, unknown>;
    };
    expect(audit.actor_id).toBe(ADMIN_ID);
    expect(audit.action).toBe("voter_deleted");
    expect(audit.target_id).toBe(TARGET_ID);
    expect(audit.meta).toMatchObject({
      email: "voter@example.com",
      full_name: "Maria Santos",
      student_id: "2025000999",
      was_admin: false,
      was_assigned_topic_id: 5,
    });

    expect(stubs.deleteUser).toHaveBeenCalledWith(TARGET_ID);
  });

  it("voter without topic: skips storage cleanup, still audits + deletes", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: eligibleTarget({ topics: null }),
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: true });

    const kinds = stubs.calls.map((c) => c.kind);
    expect(kinds).not.toContain("storage.list");
    expect(kinds).not.toContain("storage.remove");
    expect(kinds).toContain("audit_log.insert");
    expect(kinds).toContain("deleteUser");

    const auditCall = stubs.calls.find((c) => c.kind === "audit_log.insert");
    const audit = auditCall?.payload as { meta: Record<string, unknown> };
    expect(audit.meta.was_assigned_topic_id).toBeNull();
  });

  it("non-voting admin (no topic, no ballot, is_admin=true): deletes cleanly", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: eligibleTarget({
        topics: null,
        ballots: null,
        is_admin: true,
      }),
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: true });

    const auditCall = stubs.calls.find((c) => c.kind === "audit_log.insert");
    const audit = auditCall?.payload as { meta: Record<string, unknown> };
    expect(audit.meta.was_admin).toBe(true);
    expect(stubs.deleteUser).toHaveBeenCalledWith(TARGET_ID);
  });

  it("returns DELETE_FAILED when auth.admin.deleteUser fails after audit", async () => {
    const stubs = makeStubs({
      user: { id: ADMIN_ID },
      callerProfile: approvedAdmin(),
      targetProfile: eligibleTarget({ topics: null }),
      deleteUserError: { message: "auth admin down" },
    });
    mockedCreateClient.mockResolvedValue(stubs.supabase as never);
    mockedCreateServiceClient.mockReturnValue(stubs.supabaseAdmin as never);

    const result = await deleteVoter(TARGET_ID);
    expect(result).toEqual({ ok: false, error: "DELETE_FAILED" });

    // Audit row was still written — captures intent on partial failure.
    const auditCall = stubs.calls.find((c) => c.kind === "audit_log.insert");
    expect(auditCall).toBeDefined();
  });
});
