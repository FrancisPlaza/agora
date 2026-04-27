"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  lockBallots,
  openPolls,
  reopenPollsAndUnlockDrafts,
  runTallyFromAdmin,
  setDeadline,
} from "@/lib/actions/admin";

interface DeadlineFormProps {
  initialIso: string | null;
}

/**
 * `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm`. Convert the
 * stored ISO (UTC) to the *server's* local-time representation for the
 * default value, so the displayed time matches what the beadle set.
 */
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DeadlineForm({ initialIso }: DeadlineFormProps) {
  const [value, setValue] = useState(isoToDatetimeLocal(initialIso));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fire() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("deadlineIso", value);
      const result = await setDeadline(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Deadline" htmlFor="deadlineIso">
        <Input
          id="deadlineIso"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button kind="primary" onClick={fire} disabled={isPending}>
          {isPending ? "Saving…" : "Save deadline"}
        </Button>
        {error ? (
          <span className="text-xs text-danger">{error}</span>
        ) : savedAt ? (
          <span className="text-xs text-success">Saved · {savedAt}</span>
        ) : null}
      </div>
    </div>
  );
}

export function OpenPollsButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fire() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      // Empty openAtIso → server defaults to now()
      const result = await openPolls(fd);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button kind="secondary" onClick={fire} disabled={isPending}>
        {isPending ? "Opening…" : "Open polls now"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}

export function ReopenAndUnlockButton({ count }: { count: number }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fire() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      const result = await reopenPollsAndUnlockDrafts(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      const n = result.unlocked ?? 0;
      setSuccess(
        `Polls reopened. ${n} draft ballot${n === 1 ? "" : "s"} unlocked.`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button kind="ghost" onClick={fire} disabled={isPending}>
        {isPending
          ? "Reopening…"
          : `Reopen and unlock ${count} draft${count === 1 ? "" : "s"}`}
      </Button>
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : success ? (
        <span className="text-xs text-success">{success}</span>
      ) : null}
    </div>
  );
}

export function LockBallotsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button kind="solid-danger" icon="lock" onClick={() => setOpen(true)}>
        Lock ballots now
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Lock all ballots?"
        description="This force-locks every unsubmitted draft (their voters won't be able to edit unless you per-voter unlock). Submitted ballots are unaffected. The action is audit-logged."
        confirmLabel="Lock ballots"
        confirmKind="solid-danger"
        onConfirm={lockBallots}
      />
    </>
  );
}

export function RunTallyButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        kind="primary"
        icon="trophy"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Run tally
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Run the tally?"
        description="Reads every submitted ballot, runs sequential IRV, writes the results. The action is idempotent — re-running overwrites the previous tally with the same inputs."
        confirmLabel="Run tally"
        onConfirm={runTallyFromAdmin}
      />
    </>
  );
}
