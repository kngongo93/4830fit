import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEditableRoutine } from "@/lib/access";
import { getProgramDay, describeDay } from "@/lib/programs";
import { listExercisesFor } from "@/lib/queries";
import {
  addBlockAction,
  deleteBlockAction,
  deleteItemAction,
  startFromDayAction,
} from "@/app/actions/programs";
import { AddExerciseToBlock } from "@/components/add-exercise-to-block";

export const dynamic = "force-dynamic";

export default async function ProgramDayPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>;
}) {
  const user = await requireUser();
  const { id, dayId } = await params;

  const routine = await getEditableRoutine(user.id, id);
  if (!routine) notFound();

  const day = await getProgramDay(dayId);
  if (!day) notFound();

  const available = await listExercisesFor(user.id);
  const totalLifts = day.blocks.reduce((n, b) => n + b.items.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/programs/${routine.id}`} className="text-xs text-ink-400 hover:text-ink-200">
          ‹ {routine.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{describeDay(day)}</h1>
        <p className="mt-1 text-sm text-ink-400">
          {day.blocks.length} {day.blocks.length === 1 ? "block" : "blocks"} · {totalLifts}{" "}
          {totalLifts === 1 ? "exercise" : "exercises"}
        </p>
      </div>

      {totalLifts > 0 && (
        <form action={startFromDayAction}>
          <input type="hidden" name="dayId" value={day.id} />
          <button type="submit" className="btn-primary w-full py-4 text-base">
            Start this workout
          </button>
        </form>
      )}

      {day.blocks.map((block) => (
        <section key={block.id} className="card overflow-hidden">
          <div className="flex items-start justify-between gap-2 border-b border-ink-800 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-ink-200">{block.name}</h2>
              {block.focus && (
                <p className="mt-0.5 truncate text-xs text-ink-400">{block.focus}</p>
              )}
            </div>
            <form action={deleteBlockAction}>
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="dayId" value={day.id} />
              <button
                type="submit"
                className="shrink-0 rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
              >
                Remove
              </button>
            </form>
          </div>

          {block.items.length > 0 && (
            <ul className="divide-y divide-ink-800">
              {block.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-200">
                      {item.exercise.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {item.targetSets} × {item.targetReps}
                      {item.targetRpe ? ` @ RPE ${item.targetRpe}` : ""}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </p>
                  </div>
                  <form action={deleteItemAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="dayId" value={day.id} />
                    <button
                      type="submit"
                      aria-label={`Remove ${item.exercise.name}`}
                      className="shrink-0 px-1 text-ink-400 hover:text-red-400"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-ink-800 p-4">
            <AddExerciseToBlock blockId={block.id} dayId={day.id} exercises={available} />
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Add a block
        </h2>
        <form action={addBlockAction} className="card space-y-3 p-4">
          <input type="hidden" name="dayId" value={day.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="block-name">
                Name
              </label>
              <input
                id="block-name"
                name="name"
                className="field"
                placeholder={`Block ${String.fromCharCode(65 + day.blocks.length)}`}
              />
            </div>
            <div>
              <label className="label" htmlFor="block-focus">
                Focus
              </label>
              <input
                id="block-focus"
                name="focus"
                className="field"
                placeholder="chest and triceps"
              />
            </div>
          </div>
          <button type="submit" className="btn-ghost w-full">
            Add block
          </button>
        </form>
      </section>
    </div>
  );
}
