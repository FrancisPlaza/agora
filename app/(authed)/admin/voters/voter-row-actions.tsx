"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import {
  assignTopic,
  deleteVoter,
  unlockBallot,
  type DeleteVoterError,
} from "@/lib/actions/admin";
import type { BallotStatus, UnassignedTopic } from "@/lib/data/admin";

interface Props {
  voterId: string;
  voterName: string;
  /** The signed-in admin's profile id — used to disable Delete on the caller's own row. */
  currentUserId: string;
  /**
   * True when this row is a non-voting admin (is_admin = true, no
   * assigned topic — e.g. the professor). Hides the Reassign button:
   * non-voting admins are not presenters, so a topic assignment makes
   * no sense in their row.
   */
  isNonVotingAdmin: boolean;
  ballot_status: BallotStatus;
  hasArt: boolean;
  currentTopicId: number | null;
  currentTopicPresented: boolean;
  /** Used in the delete-confirmation modal to name the freed topic. */
  currentTopicPhilosopher: string | null;
  currentTopicTheme: string | null;
  /**
   * True when polls are locked, deadline has passed, or a tally is
   * cached. Gates BOTH reassign and per-voter unlock-ballot:
   *   • Reassign past this point would silently substitute a
   *     presenter for committed ballots (migration 0021).
   *   • Per-voter unlock past this point would let one voter edit
   *     while everyone else is frozen, and after a tally would
   *     diverge from the IRV input (migration 0022).
   */
  pollsLocked: boolean;
  reassignableTopics: UnassignedTopic[];
}

const DELETE_ERROR_COPY: Record<DeleteVoterError, string> = {
  NOT_AUTHORISED: "You aren't authorised to delete voters.",
  SELF_DELETE_FORBIDDEN: "You can't delete your own account.",
  NOT_FOUND: "Voter no longer exists.",
  ALREADY_PRESENTED: "Cannot delete — they've already presented.",
  BALLOT_SUBMITTED: "Cannot delete — ballot already submitted.",
  DELETE_FAILED:
    "Delete partly succeeded — some cleanup failed. Check the audit log.",
};

export function VoterRowActions({
  voterId,
  voterName,
  currentUserId,
  isNonVotingAdmin,
  ballot_status,
  hasArt,
  currentTopicId,
  currentTopicPresented,
  currentTopicPhilosopher,
  currentTopicTheme,
  pollsLocked,
  reassignableTopics,
}: Props) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reassignTopicId, setReassignTopicId] = useState("");

  // Filter the voter's own current topic out of the dropdown so the
  // no-op case is unreachable from the UI. The migration 0020 short-
  // circuit is the safety net.
  const dropdownTopics = reassignableTopics.filter(
    (t) => t.id !== currentTopicId,
  );

  // Row-specific reason — survives the polls-lock state, since a
  // presented topic stays locked even after a reopen. "Polls locked"
  // is global and shown via the absence of buttons across the page,
  // not per-row text.
  const reassignReason: string | null = currentTopicPresented
    ? "Already presented."
    : null;

  // Hide Reassign entirely (vs. disabled-with-note) when the row is
  // unactionable for any reason. Function-level POLLS_LOCKED gate
  // (0021) and STUDENT_ALREADY_PRESENTED (0020) are the direct-RPC
  // backstops. Non-voting admins are also hidden — they aren't
  // presenters, so a topic assignment is conceptually wrong.
  const hideReassign =
    currentTopicPresented || pollsLocked || isNonVotingAdmin;

  // Delete eligibility — voters who have already presented or
  // submitted a ballot are permanent class artefacts, and admins can't
  // delete themselves through this UI. The action's server-side gates
  // are the backstops for races.
  const isSelf = voterId === currentUserId;
  const deleteBlockReason: string | null = isSelf
    ? "Cannot delete — this is you"
    : currentTopicPresented
      ? "Cannot delete — already presented"
      : ballot_status === "submitted"
        ? "Cannot delete — ballot submitted"
        : null;

  return (
    <div className="flex justify-end gap-2 flex-wrap items-center">
      {reassignReason ? (
        <span className="text-xs text-text-2 italic">{reassignReason}</span>
      ) : null}
      {!hideReassign ? (
        <Button
          kind="ghost"
          size="sm"
          onClick={() => setReassignOpen(true)}
        >
          Reassign
        </Button>
      ) : null}
      {ballot_status === "submitted" && !pollsLocked ? (
        <Button
          kind="ghost"
          size="sm"
          onClick={() => setUnlockOpen(true)}
        >
          Unlock ballot
        </Button>
      ) : null}
      <Button
        kind="danger"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        disabled={!!deleteBlockReason}
        title={deleteBlockReason ?? undefined}
      >
        Delete
      </Button>

      <ConfirmDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title={`Reassign ${voterName}`}
        description={
          <>
            <p className="m-0 mb-2">
              Pick the new topic. This wipes the topic&rsquo;s current art
              fields if any, so the new presenter starts clean.
              {hasArt ? " Their existing artwork will be deleted from storage." : ""}
            </p>
            <Select
              value={reassignTopicId}
              onChange={(e) => setReassignTopicId(e.target.value)}
            >
              <option value="">Select a topic…</option>
              {dropdownTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  Nº {String(t.order_num).padStart(2, "0")} · {t.philosopher}
                </option>
              ))}
            </Select>
          </>
        }
        confirmLabel="Reassign"
        confirmKind={hasArt ? "solid-danger" : "primary"}
        onConfirm={async () => {
          if (!reassignTopicId) {
            return { error: "Pick a topic first." };
          }
          const fd = new FormData();
          fd.set("targetId", voterId);
          fd.set("topicId", reassignTopicId);
          const result = await assignTopic(fd);
          if (result.error) return result;
          setReassignTopicId("");
        }}
      />

      <ConfirmDialog
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        title={`Unlock ${voterName}'s ballot?`}
        description="Their existing rankings stay put — they can edit and resubmit. Use this for genuine errors only; the action is audit-logged."
        confirmLabel="Unlock"
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("targetVoterId", voterId);
          return unlockBallot(fd);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${voterName}?`}
        description={
          <>
            <p className="m-0 mb-2">This will:</p>
            <ul className="m-0 mb-2 pl-5 list-disc text-[13px]">
              <li>
                {currentTopicId &&
                currentTopicPhilosopher &&
                currentTopicTheme ? (
                  <>
                    return their assigned topic ({currentTopicPhilosopher} —{" "}
                    {currentTopicTheme}) to the unassigned pool
                  </>
                ) : (
                  <>release no topic — they didn&rsquo;t have one assigned</>
                )}
              </li>
              <li>
                delete their draft ballot and any private or class-shared notes
              </li>
              <li>remove them from the voter roster</li>
            </ul>
            <p className="m-0">
              This cannot be undone. The student will need to register again to
              rejoin.
            </p>
          </>
        }
        confirmLabel="Delete voter"
        confirmKind="solid-danger"
        onConfirm={async () => {
          const result = await deleteVoter(voterId);
          if (!result.ok) {
            return { error: DELETE_ERROR_COPY[result.error] };
          }
        }}
      />
    </div>
  );
}
