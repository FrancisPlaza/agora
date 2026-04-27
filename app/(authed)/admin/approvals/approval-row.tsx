"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveVoter,
  rejectVoter,
} from "@/lib/actions/admin";
import type { PendingApproval, UnassignedTopic } from "@/lib/data/admin";
import { formatRelative } from "@/lib/relative-time";

interface ApprovalRowProps {
  voter: PendingApproval;
  unassignedTopics: UnassignedTopic[];
}

export function ApprovalRow({ voter, unassignedTopics }: ApprovalRowProps) {
  const [topicId, setTopicId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function fireApprove(opts: { asAdmin: boolean }) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("targetId", voter.id);
      if (!opts.asAdmin) fd.set("topicId", topicId);
      if (opts.asAdmin) fd.set("isAdmin", "on");
      const result = await approveVoter(fd);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <tr>
        <td className="px-3 py-3 align-middle">
          <div className="flex items-center gap-2.5">
            <Avatar name={voter.full_name} size={28} />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{voter.full_name}</div>
              <div className="text-text-2 text-xs truncate">{voter.email}</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 align-middle font-mono text-[13px]">
          {voter.student_id}
        </td>
        <td className="px-3 py-3 align-middle text-text-2 text-[13px]">
          {formatRelative(voter.created_at)}
        </td>
        <td className="px-3 py-3 align-middle min-w-[220px]">
          <Select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            disabled={isPending}
          >
            <option value="">Select a topic…</option>
            {unassignedTopics.map((t) => (
              <option key={t.id} value={t.id}>
                Nº {String(t.order_num).padStart(2, "0")} · {t.philosopher}
              </option>
            ))}
          </Select>
          {error ? (
            <div className="text-xs text-danger mt-1">{error}</div>
          ) : null}
        </td>
        <td className="px-3 py-3 align-middle">
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              kind="danger"
              size="sm"
              onClick={() => setRejectOpen(true)}
              disabled={isPending}
            >
              Reject
            </Button>
            <Button
              kind="ghost"
              size="sm"
              onClick={() => fireApprove({ asAdmin: true })}
              disabled={isPending}
              title="Approve as a non-voting admin (e.g. the professor) — no topic assignment"
            >
              Approve as admin
            </Button>
            <Button
              kind="primary"
              size="sm"
              onClick={() => fireApprove({ asAdmin: false })}
              disabled={isPending || !topicId}
            >
              Approve as voter
            </Button>
          </div>
        </td>
      </tr>
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`Reject ${voter.full_name}?`}
        description={
          <>
            <p className="m-0 mb-2">
              Their account will be marked rejected. Tell them why — they&rsquo;ll
              see this on the rejection screen.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. mismatched student ID"
              className="min-h-20"
            />
          </>
        }
        confirmLabel="Reject"
        confirmKind="solid-danger"
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("targetId", voter.id);
          fd.set("reason", rejectReason);
          const result = await rejectVoter(fd);
          if (result.error) return result;
          setRejectReason("");
        }}
      />
    </>
  );
}
