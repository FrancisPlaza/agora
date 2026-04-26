"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateNameAction, type FormState } from "./actions";

interface Props {
  initialName: string;
  email: string;
  studentId: string;
}

export function ProfileForm({ initialName, email, studentId }: Props) {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    updateNameAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Full name" htmlFor="fullName">
        <Input
          id="fullName"
          name="fullName"
          required
          defaultValue={initialName}
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="School email" hint="Read-only">
          <Input value={email} readOnly tabIndex={-1} />
        </Field>
        <Field label="Student ID" hint="Read-only">
          <Input value={studentId} readOnly tabIndex={-1} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button kind="primary" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {state?.saved ? (
          <span className="text-[13px] text-success">Saved.</span>
        ) : null}
        {state?.error ? (
          <span className="text-[13px] text-danger">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
