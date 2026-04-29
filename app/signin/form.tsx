"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInAction, type FormState } from "./actions";

export function SignInForm({ initialError }: { initialError?: string }) {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    signInAction,
    initialError ? { error: initialError } : null,
  );

  return (
    <>
      <p className="text-text-2 mb-5">
        We&rsquo;ll send a one-time link to your email.
      </p>
      <form action={formAction} className="flex flex-col gap-3.5">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="niccolo@machiavelli.com"
            defaultValue={state?.values?.email ?? ""}
          />
        </Field>
        {state?.error ? (
          <div className="text-xs text-danger">{state.error}</div>
        ) : null}
        <Button kind="primary" size="lg" block type="submit" disabled={isPending}>
          {isPending ? "Sending magic link…" : "Send magic link"}
        </Button>
      </form>
    </>
  );
}
