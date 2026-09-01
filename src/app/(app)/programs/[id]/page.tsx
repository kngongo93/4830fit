import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getEditableRoutine, listRoutineAssignees } from "@/lib/access";
import { getProgramDays, describeDay, WEEKDAYS } from "@/lib/programs";
import {
  addDayAction,
  deleteDayAction,
  archiveProgramAction,
  startFromDayAction,
  unassignProgramAction,
} from "@/app/actions/programs";
import { AssignForm } from "@/components/assign-form";

export const dynamic = "force-dynamic";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const routine = await getEditableRoutine(user.id, id);
  if (!routine) notFound();

  const [days, assignees, author] = await Promise.all([
    getProgramDays(routine.id),
    listRoutineAssignees(routine.id),
    db.select().from(users).where(eq(users.id, routine.ownerId)).limit(1),
  ]);

  const isAuthor = routine.ownerId === user.id;

  return (
    <div className="space-y-7">
      <div>
        <Link href="/programs" className="text-xs text-ink-400 hover:text-ink-200">
          ‹ Programs
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{routine.name}</h1>
        {routine.description && (
          <p className="mt-1 text-sm text-ink-400">{routine.description}</p>
        )}
        {!isAuthor && author[0] && (
          <p className="mt-1 text-xs text-accent">
            Written by {author[0].name}. You can change it — your edits are yours.
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Days
        </h2>

        {days.length === 0 ? (
          <div className="card p-5 text-sm leading-relaxed text-ink-400">
            No days yet. Add one below, then fill it with blocks.
          </div>
        ) : (
          <ul className="space-y-2">
            {days.map((day) => {
              const lifts = day.blocks.reduce((n, b) => n + b.items.length, 0);
              return (
                <li key={day.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/programs/${routine.id}/day/${day.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-200">{describeDay(day)}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {day.blocks.length === 0
                          ? "No blocks yet"
                          : day.blocks
                              .map((b) => (b.focus ? `${b.name}: ${b.focus}` : b.name))
                              .join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-ink-400">
                        {lifts} {lifts === 1 ? "exercise" : "exercises"}
                      </p>
                    </Link>

                    <form action={deleteDayAction}>
                      <input type="hidden" name="dayId" value={day.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </form>
                  </div>

                  {lifts > 0 && (
                    <form action={startFromDayAction} className="mt-3">
                      <input type="hidden" name="dayId" value={day.id} />
                      <button type="submit" className="btn-primary w-full">
                        Start {describeDay(day)}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Add a day
        </h2>
        <form action={addDayAction} className="card space-y-3 p-4">
          <input type="hidden" name="routineId" value={routine.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" required className="field" placeholder="Monday" />
            </div>
            <div>
              <label className="label" htmlFor="weekday">
                Day of week
              </label>
              <select id="weekday" name="weekday" className="field" defaultValue="">
                <option value="">Not pinned</option>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-ghost w-full">
            Add day
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Who is running this
        </h2>
        <div className="card p-4">
          <p className="text-sm leading-relaxed text-ink-400">
            Assign this program to someone and it appears on their Today screen. They can
            adjust it to suit themselves — you are handing over a plan, not locking it.
          </p>

          <div className="mt-4">
            <AssignForm routineId={routine.id} />
          </div>

          {assignees.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-ink-800 pt-4">
              {assignees.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-200">{person.name}</p>
                    <p className="truncate text-xs text-ink-400">{person.email}</p>
                  </div>
                  <form action={unassignProgramAction}>
                    <input type="hidden" name="routineId" value={routine.id} />
                    <input type="hidden" name="userId" value={person.id} />
                    <button
                      type="submit"
                      className="shrink-0 rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isAuthor && (
        <form action={archiveProgramAction}>
          <input type="hidden" name="routineId" value={routine.id} />
          <button
            type="submit"
            className="w-full py-2 text-center text-xs text-ink-400 hover:text-red-400"
          >
            Delete this program
          </button>
        </form>
      )}
    </div>
  );
}
