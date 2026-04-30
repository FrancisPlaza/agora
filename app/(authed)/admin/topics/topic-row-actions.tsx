"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { assignTopic, markTopicPresented } from "@/lib/actions/admin";
import type { TopicState } from "@/lib/data/topics";

interface VoterOption {
  id: string;
  full_name: string;
  /**
   * If the voter is currently presenting another (unpresented) topic,
   * carry the philosopher name so the dropdown can hint that picking
   * them will swap their assignment.
   */
  current_topic: { philosopher: string } | null;
}

interface Props {
  topicId: number;
  topicLabel: string;
  state: TopicState;
  hadArt: boolean;
  currentPresenterId: string | null;
  /**
   * True when polls are locked, deadline has passed, or a tally is
   * cached. Reassigning past this point would silently substitute a
   * presenter for committed ballots. Function-level POLLS_LOCKED gate
   * (migrations 0021 + 0022) is the backstop.
   */
  pollsLocked: boolean;
  reassignableVoters: VoterOption[];
}

export function TopicRowActions({
  topicId,
  topicLabel,
  state,
  hadArt,
  currentPresenterId,
  pollsLocked,
  reassignableVoters,
}: Props) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [voterId, setVoterId] = useState("");
  const [presentingError, setPresentingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Row-level reasons take precedence over the polls-locked reason —
  // they're more specific, and a presented topic stays locked even
  // after a reopen. Function-level: 0020's TOPIC_ALREADY_PRESENTED for
  // the row case; 0021's POLLS_LOCKED for the polls case. Copy is
  // harmonised with the voters view ("Already presented.").
  const reassignReason: string | null =
    state === "presented" || state === "published"
      ? "Already presented."
      : pollsLocked
        ? "Polls locked. Reopen to reassign."
        : null;

  // Filter the topic's own current presenter out of the dropdown — the
  // no-op short-circuit catches it server-side, but UX-cleaner to hide.
  const dropdownVoters = reassignableVoters.filter(
    (v) => v.id !== currentPresenterId,
  );

  function firePresented() {
    setPresentingError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("topicId", String(topicId));
      const result = await markTopicPresented(fd);
      if (result.error) setPresentingError(result.error);
    });
  }

  return (
    <div className="flex justify-end gap-2 flex-wrap items-center">
      {presentingError ? (
        <span className="text-xs text-danger">{presentingError}</span>
      ) : null}
      {state === "assigned" ? (
        <Button
          kind="primary"
          size="sm"
          onClick={firePresented}
          disabled={isPending}
        >
          Mark presented
        </Button>
      ) : null}
      {reassignReason ? (
        <span className="text-xs text-text-2 italic">{reassignReason}</span>
      ) : null}
      <Button
        kind="ghost"
        size="sm"
        onClick={() => setReassignOpen(true)}
        disabled={reassignReason !== null}
      >
        Reassign
      </Button>

      <ConfirmDialog
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title={`Reassign ${topicLabel}`}
        description={
          <>
            <p className="m-0 mb-2">
              Pick the new presenter. Voters without an assigned topic, plus
              voters whose current topic hasn&rsquo;t been presented yet, are
              shown — picking the latter swaps their assignment.
              {hadArt
                ? " The topic's existing artwork will be wiped from storage."
                : ""}
            </p>
            <Select
              value={voterId}
              onChange={(e) => setVoterId(e.target.value)}
            >
              <option value="">Select a voter…</option>
              {dropdownVoters.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
                  {v.current_topic
                    ? ` (currently ${v.current_topic.philosopher})`
                    : ""}
                </option>
              ))}
            </Select>
          </>
        }
        confirmLabel="Reassign"
        confirmKind={hadArt ? "solid-danger" : "primary"}
        onConfirm={async () => {
          if (!voterId) return { error: "Pick a voter first." };
          const fd = new FormData();
          fd.set("targetId", voterId);
          fd.set("topicId", String(topicId));
          const result = await assignTopic(fd);
          if (result.error) return result;
          setVoterId("");
        }}
      />
    </div>
  );
}
