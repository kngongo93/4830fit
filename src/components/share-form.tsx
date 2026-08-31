"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { grantAccessAction, type FormState } from "@/app/actions/sharing";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost shrink-0" disabled={pending}>
      {pending ? "..." : "Share"}
    </button>
  );
}

export function ShareForm() {
  const [state, formAction] = useActionState<FormState, FormData>(grantAccessAction, {});

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="share-email">
            Their email
          </label>
          <input
            id="share-email"
            name="email"
            type="email"
            required
            className="field"
            placeholder="marcus@example.com"
          />
        </div>
        <SubmitButton />
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
      {state.notice && <p className="text-xs text-accent">{state.notice}</p>}
    </form>
  );
}
