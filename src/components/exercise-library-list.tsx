"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { Exercise } from "@/db/schema";

export function ExerciseLibrary({ exercises }: { exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");

  const groups = useMemo(() => {
    const seen = new Set(exercises.map((e) => e.muscleGroup));
    return ["all", ...[...seen].sort()];
  }, [exercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (group !== "all" && e.muscleGroup !== group) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q);
    });
  }, [exercises, query, group]);

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="field"
        placeholder="Search lifts..."
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

      <ul className="space-y-1.5">
        {results.map((exercise) => (
          <li key={exercise.id}>
            <Link
              href={`/exercises/${exercise.id}`}
              className="card block px-4 py-3 transition hover:border-ink-600"
            >
              <span className="block truncate text-sm font-medium text-ink-200">
                {exercise.name}
              </span>
              <span className="block truncate text-xs capitalize text-ink-400">
                {exercise.muscleGroup} · {exercise.equipment}
                {exercise.ownerId && " · yours"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
