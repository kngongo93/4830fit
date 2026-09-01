import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listRoutinesFor } from "@/lib/access";
import { getActiveWorkout, getRecentWorkouts } from "@/lib/queries";
import { getProgramDays, describeDay, type ProgramDay } from "@/lib/programs";
import { startWorkoutAction } from "@/app/actions/workout";
import { startFromDayAction } from "@/app/actions/programs";
import { WorkoutSummaryCard } from "@/components/workout-summary-card";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const [active, recent, programs] = await Promise.all([
    getActiveWorkout(user.id),
    getRecentWorkouts(user.id, 5),
    listRoutinesFor(user.id),
  ]);

  const weekday = new Date().getDay();

  // Days pinned to today across every program the user runs, plus the rest
  // of each program so an unpinned rotation is still one tap away.
  const scheduled: { programName: string; day: ProgramDay }[] = [];
  const otherDays: { programName: string; day: ProgramDay }[] = [];

  for (const { routine } of programs) {
    const days = await getProgramDays(routine.id);
    for (const day of days) {
      if (day.blocks.every((b) => b.items.length === 0)) continue;
      const entry = { programName: routine.name, day };
      if (day.weekday === weekday) scheduled.push(entry);
      else otherDays.push(entry);
    }
  }

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
          <p className="mt-1 text-sm text-ink-400">Started {formatTime(active.startedAt)}</p>
          <Link href={`/workout/${active.id}`} className="btn-primary mt-4 w-full">
            Resume workout
          </Link>
        </div>
      ) : (
        <>
          {scheduled.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">
                On the plan today
              </h2>
              <ul className="space-y-2">
                {scheduled.map(({ programName, day }) => (
                  <li key={day.id}>
                    <ProgramDayCard programName={programName} day={day} highlight />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form action={startWorkoutAction}>
            <button
              type="submit"
              className={scheduled.length > 0 ? "btn-ghost w-full" : "btn-primary w-full py-4 text-base"}
            >
              {scheduled.length > 0 ? "Log something else instead" : "Start a workout"}
            </button>
          </form>

          {otherDays.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Other days
              </h2>
              <ul className="space-y-2">
                {otherDays.slice(0, 6).map(({ programName, day }) => (
                  <li key={day.id}>
                    <ProgramDayCard programName={programName} day={day} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Recent
        </h2>

        {history.length === 0 ? (
          <div className="card p-5 text-sm leading-relaxed text-ink-400">
            Nothing logged yet. Build a program under Programs, or just start a workout and
            add lifts as you go.
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

function ProgramDayCard({
  programName,
  day,
  highlight,
}: {
  programName: string;
  day: ProgramDay;
  highlight?: boolean;
}) {
  const lifts = day.blocks.reduce((n, b) => n + b.items.length, 0);

  return (
    <div className={highlight ? "card border-accent/40 bg-accent/5 p-4" : "card p-4"}>
      <p className="text-xs text-ink-400">{programName}</p>
      <p className="mt-0.5 font-semibold text-ink-200">{describeDay(day)}</p>
      <p className="mt-1 text-xs text-ink-400">
        {day.blocks.map((b) => (b.focus ? `${b.name}: ${b.focus}` : b.name)).join(" · ")}
      </p>
      <p className="mt-0.5 text-xs text-ink-400">
        {lifts} {lifts === 1 ? "exercise" : "exercises"}
      </p>

      <form action={startFromDayAction} className="mt-3">
        <input type="hidden" name="dayId" value={day.id} />
        <button type="submit" className={highlight ? "btn-primary w-full" : "btn-ghost w-full"}>
          Start {describeDay(day)}
        </button>
      </form>
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
