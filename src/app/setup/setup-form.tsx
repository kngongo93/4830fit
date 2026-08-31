"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createFirstAdminAction, type FormState } from "@/app/actions/admin";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Creating..." : "Create admin account"}
    </button>
  );
}

export function SetupForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createFirstAdminAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" required autoFocus className="field" placeholder="Kevin" />
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          className="field"
          placeholder="At least 10 characters"
        />
      </div>

      <div>
        <label className="label" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="field"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
