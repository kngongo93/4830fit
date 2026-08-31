import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEditableWorkout } from "@/lib/access";
import { getLastPerformance, getWorkoutDetail } from "@/lib/queries";
import { suggestNext, defaultIncrement } from "@/lib/training";
import { finishWorkoutAction, discardWorkoutAction } from "@/app/actions/workout";
import { ExerciseCard } from "@/components/exercise-card";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const workout = await getEditableWorkout(user.id, id);
  if (!workout) notFound();

  const entries = await getWorkoutDetail(workout.id);

  // Each card needs last week's sets and a suggested opener, resolved here
  // so the client component stays dumb and the queries run in parallel.
  const cards = await Promise.all(
    entries.map(async (entry) => {
      const last = await getLastPerformance(user.id, entry.exercise.id, workout.id);
      const suggestion = last
        ? suggestNext(
            last.sets.map((s) => ({
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              isWarmup: s.isWarmup,
            })),
            { increment: defaultIncrement(entry.exercise.equipment) },
          )
        : { weight: null, reps: null, reason: "First time logging this one" };

      return { entry, last, suggestion };
    }),
  );

  const isFinished = Boolean(workout.finishedAt);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{workout.name}</h1>
          <p className="mt-0.5 text-sm text-ink-400">
            {workout.startedAt.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            {isFinished ? " - finished" : " - in progress"}
          </p>
        </div>
      </div>

      {cards.length === 0 && (
        <div className="card p-5 text-sm leading-relaxed text-ink-400">
          No lifts yet. Add your first one below.
        </div>
      )}

      <ul className="space-y-4">
        {cards.map(({ entry, last, suggestion }) => (
          <li key={entry.entryId}>
            <ExerciseCard
              entryId={entry.entryId}
              exercise={entry.exercise}
              sets={entry.sets}
              last={
                last && {
                  performedAt: last.performedAt.toISOString(),
                  sets: last.sets.map((s) => ({
                    weight: s.weight,
                    reps: s.reps,
                    rpe: s.rpe,
                    isWarmup: s.isWarmup,
                    durationSec: s.durationSec,
                    distanceM: s.distanceM,
                  })),
                }
              }
              suggestion={suggestion}
              units={user.units}
              readOnly={isFinished}
            />
          </li>
        ))}
      </ul>

      {!isFinished && (
        <>
          <Link href={`/workout/${workout.id}/add`} className="btn-ghost w-full py-4">
            + Add exercise
          </Link>

          <div className="space-y-2 pt-2">
            <form action={finishWorkoutAction}>
              <input type="hidden" name="workoutId" value={workout.id} />
              <button type="submit" className="btn-primary w-full py-4 text-base">
                Finish workout
              </button>
            </form>

            <form action={discardWorkoutAction}>
              <input type="hidden" name="workoutId" value={workout.id} />
              <button
                type="submit"
                className="w-full py-2 text-center text-xs text-ink-400 hover:text-red-400"
              >
                Discard this session
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
