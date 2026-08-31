"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, type FormState } from "@/app/actions/admin";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ghost shrink-0" disabled={pending}>
      {pending ? "..." : "Update"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<FormState, FormData>(changePasswordAction, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.notice) ref.current?.reset();
  }, [state.notice]);

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="pw">
            New password
          </label>
          <input
            id="pw"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            className="field"
            placeholder="10+ characters"
          />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="pw2">
            Confirm
          </label>
          <input
            id="pw2"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="field"
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
