"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { setNoteVisibility, upsertNote } from "@/lib/actions/notes";

interface NoteEditorProps {
  topicId: number;
  initialBody: string;
  initialVisibility: "private" | "class";
}

type Status = "idle" | "saving" | "saved";

const DEBOUNCE_MS = 1800;

export function NoteEditor({
  topicId,
  initialBody,
  initialVisibility,
}: NoteEditorProps) {
  const [body, setBody] = useState(initialBody);
  const [shared, setShared] = useState(initialVisibility === "class");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(initialBody);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  function flush() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (body === lastSaved.current) return;
    const snapshot = body;
    setStatus("saving");
    setError(null);
    startTransition(async () => {
      const result = await upsertNote({ topicId, body: snapshot });
      if (result.error) {
        setStatus("idle");
        setError(result.error);
        return;
      }
      lastSaved.current = snapshot;
      setStatus("saved");
    });
  }

  function onChange(next: string) {
    setBody(next);
    setStatus("idle");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flush, DEBOUNCE_MS);
  }

  function onBlur() {
    flush();
  }

  function onToggleShared(next: boolean) {
    // Optimistic switch flip; revert if the action fails.
    setShared(next);
    setError(null);
    startTransition(async () => {
      const result = await setNoteVisibility({
        topicId,
        visibility: next ? "class" : "private",
      });
      if (result.error) {
        setShared(!next);
        setError(result.error);
      }
    });
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const indicator =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved · just now"
        : body
          ? "Edit to save"
          : "Notes are private until you flip the switch.";

  return (
    <div className="pt-4">
      <Textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="What's catching your attention? These are private until you share them."
        className="min-h-32"
      />
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="text-xs text-text-2 truncate min-w-0">{indicator}</div>
        <Switch
          on={shared}
          onChange={onToggleShared}
          label={
            <span className="inline-flex items-center gap-1.5">
              <Icon name={shared ? "unlock" : "lock"} size={13} />
              {shared ? "Shared with class" : "Private"}
            </span>
          }
        />
      </div>
      {error ? (
        <div className="mt-2 text-xs text-danger">{error}</div>
      ) : null}
    </div>
  );
}
