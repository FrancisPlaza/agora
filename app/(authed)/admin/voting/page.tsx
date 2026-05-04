import type { Metadata } from "next";
import Link from "next/link";
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

export const metadata: Metadata = { title: "Voting" };

function fmtDateTime(input: string | null): string {
  if (!input) return "—";
  // Render in Manila local time. This page is server-rendered on
  // Vercel (UTC), so without an explicit timeZone the displayed
  // hour drifts off by the user's offset.
  return new Date(input).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
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

  // Derived flags drive every disabled state below. Computed once at the
  // page level and threaded into the controls — components stay dumb.
  // isLocked covers both "admin pressed Lock" and "deadline passed";
  // tallyComplete is the "results are cached" signal (cleared by
  // open_polls per migration 0019); hasOpened goes true on first open
  // and stays true (lock_ballots / open_polls don't clear it).
  const isLocked = polls === "closed";
  const tallyComplete = !!voting?.tally_run_at;
  const hasOpened = !!voting?.polls_open_at;

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
          {isLocked ? (
            <div className="text-text-2 text-[13px] mb-2">
              Deadline locked. Reopen polls to change.
            </div>
          ) : null}
          <DeadlineForm
            initialIso={voting?.deadline_at ?? null}
            disabled={isLocked}
          />
          <div className="mt-4 pt-4 border-t border-line-2">
            <div className="text-[13px] text-text-2 mb-2">
              Currently open at: <b className="text-text">{fmtDateTime(voting?.polls_open_at ?? null)}</b>
            </div>
            <OpenPollsButton
              tallyExists={tallyComplete}
              disabled={!isLocked && hasOpened}
            />
            {summary.force_locked_drafts > 0 ? (
              <div className="mt-3 pt-3 border-t border-line-2">
                <div className="text-[13px] text-text-2 mb-2">
                  <b className="text-text">{summary.force_locked_drafts}</b>{" "}
                  draft ballot{summary.force_locked_drafts === 1 ? "" : "s"}{" "}
                  force-locked. Reopening polls alone won&rsquo;t restore edit
                  access.
                </div>
                <ReopenAndUnlockButton
                  count={summary.force_locked_drafts}
                  tallyExists={tallyComplete}
                />
              </div>
            ) : null}
          </div>
        </Card>

        <Card pad>
          <div className="text-text-2 text-xs font-medium uppercase tracking-[0.04em] mb-3">
            Lock & tally
          </div>
          <div className="flex flex-col gap-2.5">
            {isLocked ? (
              <div className="text-text-2 text-[13px]">
                {voting?.polls_locked_at
                  ? `Polls locked at ${fmtDateTime(voting.polls_locked_at)}.`
                  : "Polls closed by deadline."}
              </div>
            ) : null}
            <LockBallotsButton disabled={isLocked || !hasOpened} />
            {tallyComplete ? (
              <div className="text-text-2 text-[13px] mt-2">
                Tally complete at {fmtDateTime(voting?.tally_run_at ?? null)}.{" "}
                <Link
                  href="/results"
                  className="text-violet-600 hover:underline"
                >
                  View results →
                </Link>
              </div>
            ) : null}
            <RunTallyButton disabled={!isLocked || tallyComplete} />
          </div>
          {!isLocked && !tallyComplete ? (
            <div className="text-text-2 text-xs mt-2">
              Lock ballots before running the tally.
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
