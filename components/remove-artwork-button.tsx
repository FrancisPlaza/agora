"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { removeArtwork } from "@/lib/actions/presentation";

/**
 * Mounted on the upload form's edit view (only when there's existing
 * artwork to remove). Opens a confirm dialog; on confirm, calls the
 * `removeArtwork` server action which wipes storage + clears the four
 * art fields and redirects to the topic detail page.
 */
export function RemoveArtworkButton({ topicId }: { topicId: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        kind="ghost"
        type="button"
        onClick={() => setOpen(true)}
      >
        Remove artwork
      </Button>
      {error ? (
        <span className="text-xs text-danger ml-2">{error}</span>
      ) : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Remove artwork?"
        description={
          <>
            This deletes your uploaded artwork and clears the title and
            explanation. The topic returns to its pre-upload state. You
            can upload again any time.
          </>
        }
        confirmLabel="Remove artwork"
        confirmKind="solid-danger"
        onConfirm={async () => {
          setError(null);
          const result = await removeArtwork(topicId);
          if (result.error) {
            setError(result.error);
            return { error: result.error };
          }
        }}
      />
    </>
  );
}
