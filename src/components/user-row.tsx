"use client";

import { useActionState, useState } from "react";
import { deleteUserAction, setUserRoleAction, type FormState } from "@/app/actions/admin";

type Person = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
  workoutCount: number;
};

export function UserRow({ person, isSelf }: { person: Person; isSelf: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(deleteUserAction, {});

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-200">
            {person.name}
            {isSelf && <span className="ml-2 text-xs font-normal text-accent">you</span>}
          </p>
          <p className="truncate text-xs text-ink-400">{person.email}</p>
          <p className="mt-1 text-xs text-ink-400">
            {person.role} · {person.workoutCount}{" "}
            {person.workoutCount === 1 ? "workout" : "workouts"} · joined{" "}
            {new Date(person.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {!isSelf && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <form action={setUserRoleAction}>
              <input type="hidden" name="userId" value={person.id} />
              <input
                type="hidden"
                name="role"
                value={person.role === "admin" ? "member" : "admin"}
              />
              <button type="submit" className="rounded px-2 py-1 text-xs text-ink-400 hover:text-ink-200">
                Make {person.role === "admin" ? "member" : "admin"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setConfirming((v) => !v)}
              className="rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
            >
              {confirming ? "Cancel" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <form action={formAction} className="mt-3 space-y-2 border-t border-ink-800 pt-3">
          <input type="hidden" name="userId" value={person.id} />
          <p className="text-xs leading-relaxed text-ink-400">
            This deletes {person.name} and every workout, set, and record they have logged.
            It cannot be undone. Type <span className="text-ink-200">{person.email}</span> to
            confirm.
          </p>
          <input
            name="confirmEmail"
            className="field"
            placeholder={person.email}
            autoComplete="off"
          />
          {state.error && (
            <p role="alert" className="text-xs text-red-400">
              {state.error}
            </p>
          )}
          <button type="submit" className="btn-ghost w-full text-red-400 hover:text-red-300">
            Permanently delete
          </button>
        </form>
      )}

      {state.notice && <p className="mt-2 text-xs text-accent">{state.notice}</p>}
    </div>
  );
}
