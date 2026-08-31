import Link from "next/link";
import { toDisplayWeight } from "@/lib/training";

type Summary = {
  id: string;
  name: string;
  startedAt: Date;
  finishedAt: Date | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
};

export function WorkoutSummaryCard({
  workout,
  units,
  href,
}: {
  workout: Summary;
  units: "lb" | "kg";
  href?: string;
}) {
  const volume = toDisplayWeight(workout.volume, units) ?? 0;

  return (
    <Link
      href={href ?? `/workout/${workout.id}`}
      className="card block p-4 transition hover:border-ink-600"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate font-semibold text-ink-200">{workout.name}</p>
        <p className="shrink-0 text-xs text-ink-400">{formatDay(workout.startedAt)}</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
        <span>
          {workout.exerciseCount} {workout.exerciseCount === 1 ? "lift" : "lifts"}
        </span>
        <span>
          {workout.setCount} {workout.setCount === 1 ? "set" : "sets"}
        </span>
        {volume > 0 && (
          <span>
            {Math.round(volume).toLocaleString()} {units} volume
          </span>
        )}
        {!workout.finishedAt && <span className="text-accent">in progress</span>}
      </div>
    </Link>
  );
}

function formatDay(date: Date) {
  const today = new Date();
  const days = Math.floor((today.getTime() - date.getTime()) / 864e5);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
