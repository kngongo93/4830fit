import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { exercises, sets, workoutExercises, workouts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getPersonalRecords } from "@/lib/queries";
import { toDisplayWeight, formatDuration } from "@/lib/training";

const PR_LABELS: Record<string, string> = {
  heaviest_weight: "Heaviest",
  best_e1rm: "Best e1RM",
  best_volume: "Best set volume",
  best_reps: "Most reps",
  best_distance: "Furthest",
  best_duration: "Longest",
};

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, id), or(isNull(exercises.ownerId), eq(exercises.ownerId, user.id))))
    .limit(1);
  if (!exercise) notFound();

  const [records, sessions] = await Promise.all([
    getPersonalRecords(user.id, exercise.id),
    db
      .select({
        workoutId: workouts.id,
        startedAt: workouts.startedAt,
        entryId: workoutExercises.id,
      })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, user.id), eq(workoutExercises.exerciseId, exercise.id)))
      .orderBy(desc(workouts.startedAt))
      .limit(20),
  ]);

  const allSets = sessions.length
    ? await db
        .select()
        .from(sets)
        .where(
          or(...sessions.map((s) => eq(sets.workoutExerciseId, s.entryId)))!,
        )
        .orderBy(asc(sets.position))
    : [];

  const setsByEntry = new Map<string, typeof allSets>();
  for (const set of allSets) {
    const bucket = setsByEntry.get(set.workoutExerciseId);
    if (bucket) bucket.push(set);
    else setsByEntry.set(set.workoutExerciseId, [set]);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/exercises" className="text-xs text-ink-400 hover:text-ink-200">
          ‹ Lifts
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{exercise.name}</h1>
        <p className="mt-1 text-sm capitalize text-ink-400">
          {exercise.muscleGroup} · {exercise.equipment}
        </p>
      </div>

      {records.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Your records
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {records.map((pr) => (
              <div key={pr.id} className="card p-3">
                <p className="text-[11px] uppercase tracking-wide text-ink-400">
                  {PR_LABELS[pr.type] ?? pr.type}
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-accent">
                  {formatRecord(pr.type, pr.value, user.units)}
                </p>
                {pr.weight != null && pr.reps != null && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    {toDisplayWeight(pr.weight, user.units)} × {pr.reps}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Your history
        </h2>

        {sessions.length === 0 ? (
          <div className="card p-5 text-sm leading-relaxed text-ink-400">
            You have not logged this one yet. Add it to a workout and it starts tracking.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const performed = setsByEntry.get(session.entryId) ?? [];
              if (performed.length === 0) return null;

              return (
                <li key={session.entryId} className="card p-4">
                  <Link
                    href={`/workout/${session.workoutId}`}
                    className="text-xs text-ink-400 hover:text-ink-200"
                  >
                    {session.startedAt.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                  <p className="mt-1.5 font-mono text-sm text-ink-200">
                    {performed
                      .filter((s) => !s.isWarmup)
                      .map((s) => shortSet(s, user.units))
                      .join("   ·   ") || "warm-ups only"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatRecord(type: string, value: number, units: "lb" | "kg") {
  if (type === "best_duration") return formatDuration(Math.round(value));
  if (type === "best_distance") return `${(value / 1609.344).toFixed(2)} mi`;
  if (type === "best_reps") return `${value}`;
  return `${toDisplayWeight(value, units)} ${units}`;
}

function shortSet(
  set: { weight: number | null; reps: number | null; rpe: number | null },
  units: "lb" | "kg",
) {
  if (set.weight == null || set.reps == null) return `${set.reps ?? 0} reps`;
  return `${toDisplayWeight(set.weight, units)} × ${set.reps}${set.rpe ? ` @${set.rpe}` : ""}`;
}
