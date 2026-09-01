import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listRoutinesFor } from "@/lib/access";
import { getProgramDays, describeDay } from "@/lib/programs";
import { createProgramAction } from "@/app/actions/programs";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const user = await requireUser();
  const programs = await listRoutinesFor(user.id);

  const withDays = await Promise.all(
    programs.map(async (p) => ({
      ...p,
      days: await getProgramDays(p.routine.id),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Programs</h1>
        <p className="mt-1 text-sm text-ink-400">
          A program is your training week: each day holds blocks, and each block holds the
          lifts. Start a day and every exercise is waiting for you with last week&apos;s
          numbers.
        </p>
      </div>

      {withDays.length === 0 ? (
        <div className="card p-5 text-sm leading-relaxed text-ink-400">
          No programs yet. Build one below — for example a day called Monday with Block A for
          chest and triceps and Block B for cardio.
        </div>
      ) : (
        <ul className="space-y-2">
          {withDays.map(({ routine, authorName, assigned, days }) => (
            <li key={routine.id}>
              <Link
                href={`/programs/${routine.id}`}
                className="card block p-4 transition hover:border-ink-600"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-semibold text-ink-200">{routine.name}</p>
                  {assigned && (
                    <span className="shrink-0 text-xs text-accent">from {authorName}</span>
                  )}
                </div>
                {routine.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-400">
                    {routine.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-400">
                  {days.length === 0
                    ? "No days yet"
                    : days.map((d) => describeDay(d)).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          New program
        </h2>
        <form action={createProgramAction} className="card space-y-3 p-4">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="field"
              placeholder="Push Pull Legs"
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Notes (optional)
            </label>
            <input
              id="description"
              name="description"
              className="field"
              placeholder="6 week block, upper focus"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Create program
          </button>
        </form>
      </section>
    </div>
  );
}
