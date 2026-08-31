import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getViewableWorkout } from "@/lib/access";
import { getWorkoutDetail } from "@/lib/queries";
import { toDisplayWeight, estimateOneRepMax, formatDuration } from "@/lib/training";

export default async function CrewWorkoutPage({
  params,
}: {
  params: Promise<{ userId: string; workoutId: string }>;
}) {
  const me = await requireUser();
  const { workoutId } = await params;

  // getViewableWorkout resolves the owner from the workout itself and
  // checks the grant, so a guessed id in the URL gets nothing.
  const workout = await getViewableWorkout(me.id, workoutId);
  if (!workout) notFound();

  const entries = await getWorkoutDetail(workout.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{workout.name}</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          {workout.startedAt.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="card p-5 text-sm text-ink-400">Nothing was logged in this session.</div>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.entryId} className="card overflow-hidden">
              <div className="border-b border-ink-800 px-4 py-3">
                <h2 className="font-semibold text-ink-200">{entry.exercise.name}</h2>
                <p className="mt-0.5 text-xs capitalize text-ink-400">
                  {entry.exercise.muscleGroup} · {entry.exercise.equipment}
                </p>
              </div>

              <ul className="divide-y divide-ink-800">
                {entry.sets.map((set, i) => (
                  <li key={set.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-6 shrink-0 text-center text-xs font-semibold text-ink-400">
                      {set.isWarmup ? "W" : i + 1}
                    </span>
                    <span className="flex-1 font-mono text-ink-200">
                      {describe(set, me.units)}
                    </span>
                    {set.weight != null && set.reps != null && !set.isWarmup && (
                      <span className="shrink-0 text-xs text-ink-400">
                        e1RM {toDisplayWeight(estimateOneRepMax(set.weight, set.reps), me.units)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describe(
  set: {
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    durationSec: number | null;
    distanceM: number | null;
  },
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
