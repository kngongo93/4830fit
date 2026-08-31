import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { getRecentWorkouts } from "@/lib/queries";
import { WorkoutSummaryCard } from "@/components/workout-summary-card";

export default async function CrewMemberPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const me = await requireUser();
  const { userId } = await params;

  // A revoked grant lands here as a plain 404, same as a stranger would
  // get, so the page never confirms whose account exists.
  if (!(await canView(me.id, userId))) notFound();

  const [owner] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!owner) notFound();

  const workouts = await getRecentWorkouts(owner.id, 50);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{owner.name}</h1>
        <p className="mt-1 text-sm text-ink-400">
          {workouts.length} recent {workouts.length === 1 ? "session" : "sessions"} · read only
        </p>
      </div>

      {workouts.length === 0 ? (
        <div className="card p-5 text-sm text-ink-400">
          {owner.name} has not logged anything yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <WorkoutSummaryCard
                workout={workout}
                units={me.units}
                href={`/crew/${owner.id}/workout/${workout.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
