"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { Exercise } from "@/db/schema";
import { addExerciseAction } from "@/app/actions/workout";

export function ExercisePicker({
  workoutId,
  exercises,
}: {
  workoutId: string;
  exercises: Exercise[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");

  const groups = useMemo(() => {
    const seen = new Set(exercises.map((e) => e.muscleGroup));
    return ["all", ...[...seen].sort()];
  }, [exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (group !== "all" && e.muscleGroup !== group) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [exercises, query, group]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field"
        placeholder="Search lifts..."
        autoFocus
        aria-label="Search exercises"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition",
              group === g
                ? "border-accent bg-accent text-ink-950"
                : "border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="card p-5 text-sm text-ink-400">
          Nothing matches. You can add your own lift from the Lifts tab.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <form action={addExerciseAction}>
                <input type="hidden" name="workoutId" value={workoutId} />
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <button
                  type="submit"
                  className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:border-ink-600"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-200">
                      {exercise.name}
                    </span>
                    <span className="block truncate text-xs capitalize text-ink-400">
                      {exercise.muscleGroup} · {exercise.equipment}
                      {exercise.ownerId && " · yours"}
                    </span>
                  </span>
                  <span className="shrink-0 text-lg text-accent">+</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
