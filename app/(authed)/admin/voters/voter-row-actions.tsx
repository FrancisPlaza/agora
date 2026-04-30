"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { assignTopic, unlockBallot } from "@/lib/actions/admin";
import type { BallotStatus, UnassignedTopic } from "@/lib/data/admin";

interface Props {
  voterId: string;
  voterName: string;
  ballot_status: BallotStatus;
  hasArt: boolean;
  currentTopicId: number | null;
  currentTopicPresented: boolean;
  reassignableTopics: UnassignedTopic[];
}

export function VoterRowActions({
  voterId,
  voterName,
  ballot_status,
  hasArt,
  currentTopicId,
  currentTopicPresented,
  reassignableTopics,
}: Props) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [reassignTopicId, setReassignTopicId] = useState("");

  // Filter the voter's own current topic out of the dropdown so the
  // no-op case is unreachable from the UI. The migration 0020 short-
  // circuit is the safety net.
  const dropdownTopics = reassignableTopics.filter(
    (t) => t.id !== currentTopicId,
  );

  return (
    <div className="flex justify-end gap-2 flex-wrap items-center">
      {currentTopicPresented ? (
        <span className="text-xs text-text-2 italic">Already presented.</span>
      ) : null}
      <Button
        kind="ghost"
        size="sm"
        onClick={() => setReassignOpen(true)}
        disabled={currentTopicPresented}
      >
        Reassign
      </Button>
      {ballot_status === "submitted" ? (
        <Button
          kind="ghost"
          size="sm"
          onClick={() => setUnlockOpen(true)}
        >
          Unlock ballot
        </Button>
      ) : null}

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
    </div>
  );
}
