import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkout, getRecentWorkouts } from "@/lib/queries";
import { startWorkoutAction } from "@/app/actions/workout";
import { WorkoutSummaryCard } from "@/components/workout-summary-card";

export default async function TodayPage() {
  const user = await requireUser();
  const [active, recent] = await Promise.all([
    getActiveWorkout(user.id),
    getRecentWorkouts(user.id, 5),
  ]);

  const history = recent.filter((w) => w.id !== active?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {active ? (
        <div className="card border-accent/40 bg-accent/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Session in progress
          </p>
          <p className="mt-1 text-lg font-semibold text-ink-200">{active.name}</p>
          <p className="mt-1 text-sm text-ink-400">
            Started {formatTime(active.startedAt)}
          </p>
          <Link href={`/workout/${active.id}`} className="btn-primary mt-4 w-full">
            Resume workout
          </Link>
        </div>
      ) : (
        <form action={startWorkoutAction}>
          <button type="submit" className="btn-primary w-full py-4 text-base">
            Start a workout
          </button>
        </form>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Recent
        </h2>

        {history.length === 0 ? (
          <div className="card p-5 text-sm leading-relaxed text-ink-400">
            Nothing logged yet. Start a workout, add your lifts, and next week this screen
            will show you exactly what to beat.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((workout) => (
              <li key={workout.id}>
                <WorkoutSummaryCard workout={workout} units={user.units} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
