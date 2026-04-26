"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PublicCard } from "@/components/public-card";
import { registerAction, type FormState } from "./actions";

export default function Register() {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    registerAction,
    null,
  );

  return (
    <PublicCard
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="text-violet-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <p className="text-text-2 mb-5">
        Your beadle will approve your account before you can vote.
      </p>
      <form action={formAction} className="flex flex-col gap-3.5">
        <Field label="Full name" htmlFor="fullName">
          <Input
            id="fullName"
            name="fullName"
            required
            placeholder="As enrolled"
            defaultValue={state?.values?.fullName ?? ""}
          />
        </Field>
        <Field label="School email" hint="@sanbeda.edu.ph" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@sanbeda.edu.ph"
            defaultValue={state?.values?.email ?? ""}
          />
        </Field>
        <Field label="Student ID" htmlFor="studentId">
          <Input
            id="studentId"
            name="studentId"
            required
            placeholder="2024-0000"
            defaultValue={state?.values?.studentId ?? ""}
          />
        </Field>
        {state?.error ? (
          <div className="text-xs text-danger">{state.error}</div>
        ) : null}
        <Button kind="primary" size="lg" block type="submit" disabled={isPending}>
          {isPending ? "Sending magic link…" : "Create account"}
        </Button>
      </form>
    </PublicCard>
  );
}
