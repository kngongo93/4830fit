"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createUserAction, type FormState } from "@/app/actions/admin";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Creating..." : "Create account"}
    </button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createUserAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a success so the next person can be added without
  // the previous one's password sitting in the form.
  useEffect(() => {
    if (state.notice) formRef.current?.reset();
  }, [state.notice]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="new-name">
            Name
          </label>
          <input id="new-name" name="name" required className="field" placeholder="Marcus" />
        </div>
        <div>
          <label className="label" htmlFor="new-role">
            Role
          </label>
          <select id="new-role" name="role" className="field" defaultValue="member">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="new-email">
          Email
        </label>
        <input
          id="new-email"
          name="email"
          type="email"
          required
          className="field"
          placeholder="marcus@example.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="new-password">
            Password
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            className="field"
            placeholder="10+ characters"
          />
        </div>
        <div>
          <label className="label" htmlFor="new-confirm">
            Confirm
          </label>
          <input
            id="new-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="field"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">{state.notice}</p>
      )}

      <SubmitButton />

      <p className="text-xs leading-relaxed text-ink-400">
        You are setting their first password, so you will know it. Tell them to change it in
        Settings once they sign in.
      </p>
    </form>
  );
}
