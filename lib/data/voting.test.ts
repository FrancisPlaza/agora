import { describe, expect, it } from "vitest";
import { derivePollsState } from "./voting";

const T0 = new Date("2026-05-15T10:00:00Z");
const before = "2026-05-15T09:00:00Z";
const after = "2026-05-15T11:00:00Z";

describe("derivePollsState", () => {
  it("returns 'closed' when polls_locked is true regardless of deadlines", () => {
    expect(
      derivePollsState(
        { polls_locked: true, polls_open_at: after, deadline_at: after },
        T0,
      ),
    ).toBe("closed");
  });

  it("returns 'closed' when deadline_at is exactly now", () => {
    expect(
      derivePollsState(
        {
          polls_locked: false,
          polls_open_at: before,
          deadline_at: T0.toISOString(),
        },
        T0,
      ),
    ).toBe("closed");
  });

  it("returns 'closed' when now is past deadline_at", () => {
    expect(
      derivePollsState(
        { polls_locked: false, polls_open_at: before, deadline_at: before },
        T0,
      ),
    ).toBe("closed");
  });

  it("returns 'not_open' when polls_open_at is null", () => {
    expect(
      derivePollsState(
        { polls_locked: false, polls_open_at: null, deadline_at: after },
        T0,
      ),
    ).toBe("not_open");
  });

  it("returns 'not_open' when polls_open_at is in the future", () => {
    expect(
      derivePollsState(
        { polls_locked: false, polls_open_at: after, deadline_at: null },
        T0,
      ),
    ).toBe("not_open");
  });

  it("returns 'open' when polls_open_at is past and deadline isn't yet hit", () => {
    expect(
      derivePollsState(
        { polls_locked: false, polls_open_at: before, deadline_at: after },
        T0,
      ),
    ).toBe("open");
  });

  it("returns 'open' when polls_open_at is past and deadline is null", () => {
    expect(
      derivePollsState(
        { polls_locked: false, polls_open_at: before, deadline_at: null },
        T0,
      ),
    ).toBe("open");
  });
});
