import { requireUser } from "@/lib/auth";
import { getRecentWorkouts } from "@/lib/queries";
import { WorkoutSummaryCard } from "@/components/workout-summary-card";

export default async function HistoryPage() {
  const user = await requireUser();
  const workouts = await getRecentWorkouts(user.id, 100);

  const months = new Map<string, typeof workouts>();
  for (const workout of workouts) {
    const key = workout.startedAt.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const bucket = months.get(key);
    if (bucket) bucket.push(workout);
    else months.set(key, [workout]);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">History</h1>

      {workouts.length === 0 ? (
        <div className="card p-5 text-sm leading-relaxed text-ink-400">
          No sessions yet. Once you log a few, this is where you look back.
        </div>
      ) : (
        [...months.entries()].map(([month, list]) => (
          <section key={month}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {month}
            </h2>
            <ul className="space-y-2">
              {list.map((workout) => (
                <li key={workout.id}>
                  <WorkoutSummaryCard workout={workout} units={user.units} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
