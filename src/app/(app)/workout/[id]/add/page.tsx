import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEditableWorkout } from "@/lib/access";
import { listExercisesFor } from "@/lib/queries";
import { ExercisePicker } from "@/components/exercise-picker";

export default async function AddExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const workout = await getEditableWorkout(user.id, id);
  if (!workout || workout.finishedAt) notFound();

  const available = await listExercisesFor(user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Add exercise</h1>
        <Link href={`/workout/${workout.id}`} className="text-sm text-ink-400 hover:text-ink-200">
          Done
        </Link>
      </div>

      <ExercisePicker workoutId={workout.id} exercises={available} />
    </div>
  );
}
