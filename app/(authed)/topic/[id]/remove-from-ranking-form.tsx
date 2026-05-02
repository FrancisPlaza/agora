"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { removeFromMyRanking } from "@/lib/actions/ballot";

interface FormState {
  error?: string;
}

export function RemoveFromRankingForm({ topicId }: { topicId: number }) {
  const action = async (
    _prev: FormState | null,
    _formData: FormData,
  ): Promise<FormState> => {
    const result = await removeFromMyRanking(topicId);
    return { error: result.error };
  };

  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button kind="secondary" icon="x" type="submit" disabled={isPending}>
        {isPending ? "Removing…" : "Remove from my ranking"}
      </Button>
      {state?.error ? (
        <span className="text-xs text-danger max-w-[260px] text-right">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
