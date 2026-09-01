"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/db/schema";
import { addItemAction } from "@/app/actions/programs";

export function AddExerciseToBlock({
  blockId,
  dayId,
  exercises,
}: {
  blockId: string;
  dayId: string;
  exercises: Exercise[];
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Exercise | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return exercises
      .filter((e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q))
      .slice(0, 8);
  }, [exercises, query]);

  if (picked) {
    return (
      <form action={addItemAction} className="space-y-3">
        <input type="hidden" name="blockId" value={blockId} />
        <input type="hidden" name="dayId" value={dayId} />
        <input type="hidden" name="exerciseId" value={picked.id} />

        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-ink-200">{picked.name}</p>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="shrink-0 text-xs text-ink-400 hover:text-ink-200"
          >
            Change
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label" htmlFor={`sets-${blockId}`}>
              Sets
            </label>
            <input
              id={`sets-${blockId}`}
              name="targetSets"
              inputMode="numeric"
              defaultValue={3}
              className="field text-center"
            />
          </div>
          <div>
            <label className="label" htmlFor={`reps-${blockId}`}>
              Reps
            </label>
            <input
              id={`reps-${blockId}`}
              name="targetReps"
              defaultValue="8"
              className="field text-center"
              placeholder="8-12"
            />
          </div>
          <div>
            <label className="label" htmlFor={`rpe-${blockId}`}>
              RPE
            </label>
            <input
              id={`rpe-${blockId}`}
              name="targetRpe"
              inputMode="decimal"
              className="field text-center"
              placeholder="—"
            />
          </div>
        </div>

        <input name="notes" className="field" placeholder="Notes (optional)" />

        <button type="submit" className="btn-primary w-full">
          Add to block
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field"
        placeholder="Add an exercise..."
        aria-label="Search exercises to add"
      />

      {matches.length > 0 && (
        <ul className="space-y-1">
          {matches.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => {
                  setPicked(exercise);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-left transition hover:border-ink-600"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-200">{exercise.name}</span>
                  <span className="block truncate text-xs capitalize text-ink-400">
                    {exercise.muscleGroup} · {exercise.equipment}
                  </span>
                </span>
                <span className="shrink-0 text-accent">+</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && matches.length === 0 && (
        <p className="text-xs text-ink-400">
          No match. Add it from the Lifts tab first, then come back.
        </p>
      )}
    </div>
  );
}
