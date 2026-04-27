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
  has_topic: boolean;
}

interface Props {
  topicId: number;
  topicLabel: string;
  state: TopicState;
  hadArt: boolean;
  unassignedVoters: VoterOption[];
}

export function TopicRowActions({
  topicId,
  topicLabel,
  state,
  hadArt,
  unassignedVoters,
}: Props) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [voterId, setVoterId] = useState("");
  const [presentingError, setPresentingError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <Button
        kind="ghost"
        size="sm"
        onClick={() => setReassignOpen(true)}
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
              Pick the new presenter. Only voters without an assigned topic are
              shown.
              {hadArt
                ? " The topic's existing artwork will be wiped from storage."
                : ""}
            </p>
            <Select
              value={voterId}
              onChange={(e) => setVoterId(e.target.value)}
            >
              <option value="">Select a voter…</option>
              {unassignedVoters.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
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
