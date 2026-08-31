"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { clsx } from "clsx";
import type { Exercise, WorkoutSet } from "@/db/schema";
import { logSetAction, deleteSetAction, removeExerciseAction } from "@/app/actions/workout";
import {
  estimateOneRepMax,
  formatDuration,
  toDisplayWeight,
  toStoredWeight,
  type Suggestion,
} from "@/lib/training";

type LastSet = {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
  durationSec: number | null;
  distanceM: number | null;
};

type Props = {
  entryId: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  last: { performedAt: string; sets: LastSet[] } | null;
  suggestion: Suggestion;
  units: "lb" | "kg";
  readOnly: boolean;
};

export function ExerciseCard({
  entryId,
  exercise,
  sets,
  last,
  suggestion,
  units,
  readOnly,
}: Props) {
  const isCardio = exercise.modality === "cardio";
  const isTimed = exercise.modality === "time";
  const usesWeight =
    exercise.modality === "weight_reps" || exercise.modality === "weighted_bodyweight";
  const usesReps = exercise.modality !== "cardio" && exercise.modality !== "time";

  const [weight, setWeight] = useState(
    suggestion.weight != null ? String(toDisplayWeight(suggestion.weight, units)) : "",
  );
  const [reps, setReps] = useState(suggestion.reps != null ? String(suggestion.reps) : "");
  const [rpe, setRpe] = useState("");
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [isWarmup, setIsWarmup] = useState(false);

  const workingSets = sets.filter((s) => !s.isWarmup);
  const increment = units === "kg" ? 2.5 : 5;

  function bump(delta: number) {
    const current = parseFloat(weight) || 0;
    const next = Math.max(0, current + delta);
    setWeight(String(Math.round(next * 100) / 100));
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-ink-800 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink-200">{exercise.name}</h3>
          <p className="mt-0.5 text-xs capitalize text-ink-400">
            {exercise.muscleGroup} · {exercise.equipment}
          </p>
        </div>
        {!readOnly && (
          <form action={removeExerciseAction}>
            <input type="hidden" name="entryId" value={entryId} />
            <button
              type="submit"
              aria-label={`Remove ${exercise.name}`}
              className="rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
            >
              Remove
            </button>
          </form>
        )}
      </div>

      {/* The reason this app exists: what you did last time, before you type. */}
      {last && (
        <div className="border-b border-ink-800 bg-ink-800/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Last time · {formatWhen(last.performedAt)}
          </p>
          <p className="mt-1.5 font-mono text-sm text-ink-200">
            {last.sets
              .filter((s) => !s.isWarmup)
              .map((s) => describeSet(s, units))
              .join("   ·   ") || "no working sets"}
          </p>
          {suggestion.weight != null && !readOnly && (
            <p className="mt-2 text-xs text-accent">
              Suggested: {toDisplayWeight(suggestion.weight, units)} {units}
              {suggestion.reps ? ` × ${suggestion.reps}` : ""} — {suggestion.reason}
            </p>
          )}
        </div>
      )}

      {sets.length > 0 && (
        <ul className="divide-y divide-ink-800">
          {sets.map((set, i) => (
            <li key={set.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span
                className={clsx(
                  "w-6 shrink-0 text-center text-xs font-semibold",
                  set.isWarmup ? "text-ink-400" : "text-accent",
                )}
              >
                {set.isWarmup ? "W" : workingSets.indexOf(set) + 1}
              </span>

              <span className="flex-1 font-mono text-ink-200">
                {describeSet(set, units)}
              </span>

              {set.weight != null && set.reps != null && !set.isWarmup && (
                <span className="shrink-0 text-xs text-ink-400">
                  e1RM {toDisplayWeight(estimateOneRepMax(set.weight, set.reps), units)}
                </span>
              )}

              {!readOnly && (
                <form action={deleteSetAction}>
                  <input type="hidden" name="setId" value={set.id} />
                  <button
                    type="submit"
                    aria-label={`Delete set ${i + 1}`}
                    className="px-1 text-ink-400 hover:text-red-400"
                  >
                    ×
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form action={logSetAction} className="border-t border-ink-800 px-4 py-3">
          <input type="hidden" name="entryId" value={entryId} />
          <input
            type="hidden"
            name="weight"
            value={usesWeight && weight ? String(toStoredWeight(parseFloat(weight), units)) : ""}
          />
          <input
            type="hidden"
            name="durationSec"
            value={minutes ? String(Math.round(parseFloat(minutes) * 60)) : ""}
          />
          <input
            type="hidden"
            name="distanceM"
            value={distance ? String(Math.round(parseFloat(distance) * 1609.344)) : ""}
          />

          <div className="flex items-end gap-2">
            {usesWeight && (
              <div className="flex-1">
                <label className="label" htmlFor={`w-${entryId}`}>
                  {units}
                </label>
                <div className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => bump(-increment)}
                    className="w-9 shrink-0 rounded-lg border border-ink-700 bg-ink-800 text-lg text-ink-200 active:scale-95"
                    aria-label={`Decrease by ${increment}`}
                  >
                    −
                  </button>
                  <input
                    id={`w-${entryId}`}
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="field min-w-0 flex-1 text-center font-mono"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => bump(increment)}
                    className="w-9 shrink-0 rounded-lg border border-ink-700 bg-ink-800 text-lg text-ink-200 active:scale-95"
                    aria-label={`Increase by ${increment}`}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {usesReps && (
              <div className="w-20">
                <label className="label" htmlFor={`r-${entryId}`}>
                  Reps
                </label>
                <input
                  id={`r-${entryId}`}
                  name="reps"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  className="field text-center font-mono"
                  placeholder="0"
                />
              </div>
            )}

            {(isCardio || isTimed) && (
              <div className="flex-1">
                <label className="label" htmlFor={`m-${entryId}`}>
                  Minutes
                </label>
                <input
                  id={`m-${entryId}`}
                  inputMode="decimal"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="field text-center font-mono"
                  placeholder="0"
                />
              </div>
            )}

            {isCardio && (
              <div className="w-24">
                <label className="label" htmlFor={`d-${entryId}`}>
                  Miles
                </label>
                <input
                  id={`d-${entryId}`}
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="field text-center font-mono"
                  placeholder="0"
                />
              </div>
            )}

            {!isCardio && (
              <div className="w-16">
                <label className="label" htmlFor={`rpe-${entryId}`}>
                  RPE
                </label>
                <input
                  id={`rpe-${entryId}`}
                  name="rpe"
                  inputMode="decimal"
                  value={rpe}
                  onChange={(e) => setRpe(e.target.value)}
                  className="field text-center font-mono"
                  placeholder="—"
                />
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-ink-400">
              <input
                type="checkbox"
                name="isWarmup"
                checked={isWarmup}
                onChange={(e) => setIsWarmup(e.target.checked)}
                className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-accent"
              />
              Warm-up
            </label>
            <LogButton />
          </div>
        </form>
      )}
    </div>
  );
}

function LogButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary ml-auto px-6" disabled={pending}>
      {pending ? "Saving..." : "Log set"}
    </button>
  );
}

function describeSet(
  set: { weight: number | null; reps: number | null; rpe: number | null; durationSec?: number | null; distanceM?: number | null },
  units: "lb" | "kg",
) {
  const parts: string[] = [];

  if (set.weight != null && set.reps != null) {
    parts.push(`${toDisplayWeight(set.weight, units)} × ${set.reps}`);
  } else if (set.reps != null) {
    parts.push(`${set.reps} reps`);
  }

  if (set.durationSec) parts.push(formatDuration(set.durationSec));
  if (set.distanceM) parts.push(`${(set.distanceM / 1609.344).toFixed(2)} mi`);
  if (set.rpe != null) parts.push(`@${set.rpe}`);

  return parts.join(" ") || "—";
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 864e5);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
