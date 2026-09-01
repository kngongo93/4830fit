"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { assignProgramAction, type FormState } from "@/app/actions/programs";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost shrink-0" disabled={pending}>
      {pending ? "..." : "Assign"}
    </button>
  );
}

export function AssignForm({ routineId }: { routineId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(assignProgramAction, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="routineId" value={routineId} />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor={`assign-${routineId}`}>
            Their email
          </label>
          <input
            id={`assign-${routineId}`}
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
