import { Card } from "@/components/ui/card";
import { getAdminSummary } from "@/lib/data/admin";
import { derivePollsState, getVotingState } from "@/lib/data/voting";
import {
  DeadlineForm,
  LockBallotsButton,
  OpenPollsButton,
  ReopenAndUnlockButton,
  RunTallyButton,
} from "./voting-controls";

function fmtDateTime(input: string | null): string {
  if (!input) return "—";
  return new Date(input).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminVoting() {
  const [summary, voting] = await Promise.all([
    getAdminSummary(),
    getVotingState(),
  ]);

  const polls = derivePollsState(
    {
      polls_locked: voting?.polls_locked ?? false,
      polls_open_at: voting?.polls_open_at ?? null,
      deadline_at: voting?.deadline_at ?? null,
    },
    new Date(),
  );

  const submitted = summary.ballots_submitted;
  const total = summary.total_voters;
  const pct = total === 0 ? 0 : Math.round((submitted / total) * 100);

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0 mb-1">
        Voting controls
      </h1>
      <p className="text-text-2 mb-6">
        Set the deadline, open polls, lock ballots, and run the tally. Polls
        currently <b>{polls === "open" ? "open" : polls === "closed" ? "closed" : "not yet open"}</b>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card pad>
          <div className="text-text-2 text-xs font-medium uppercase tracking-[0.04em]">
            Submission progress
          </div>
          <div className="font-serif text-4xl font-semibold leading-tight tracking-tight my-2">
            {submitted}{" "}
            <span className="text-text-2 text-2xl font-normal">of {total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-sunk overflow-hidden mb-1.5">
            <div
              className="h-full bg-violet rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-text-2 text-[13px]">{pct}% submitted</div>
        </Card>

        <Card pad>
          <div className="text-text-2 text-xs font-medium uppercase tracking-[0.04em] mb-3">
            Deadline & open
          </div>
          <DeadlineForm initialIso={voting?.deadline_at ?? null} />
          <div className="mt-4 pt-4 border-t border-line-2">
            <div className="text-[13px] text-text-2 mb-2">
              Currently open at: <b className="text-text">{fmtDateTime(voting?.polls_open_at ?? null)}</b>
            </div>
            <OpenPollsButton />
            {summary.force_locked_drafts > 0 ? (
              <div className="mt-3 pt-3 border-t border-line-2">
                <div className="text-[13px] text-text-2 mb-2">
                  <b className="text-text">{summary.force_locked_drafts}</b>{" "}
                  draft ballot{summary.force_locked_drafts === 1 ? "" : "s"}{" "}
                  force-locked. Reopening polls alone won&rsquo;t restore edit
                  access.
                </div>
                <ReopenAndUnlockButton count={summary.force_locked_drafts} />
              </div>
            ) : null}
          </div>
        </Card>

        <Card pad>
          <div className="text-text-2 text-xs font-medium uppercase tracking-[0.04em] mb-3">
            Lock & tally
          </div>
          <div className="text-[13px] text-text-2 mb-3">
            Locked at: <b className="text-text">{fmtDateTime(voting?.polls_locked_at ?? null)}</b>
          </div>
          <div className="flex flex-col gap-2.5">
            <LockBallotsButton />
            <RunTallyButton disabled={!voting?.polls_locked} />
          </div>
          {!voting?.polls_locked ? (
            <div className="text-text-2 text-xs mt-2">
              Lock ballots before running the tally.
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
