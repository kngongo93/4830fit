import { requireUser } from "@/lib/auth";
import { listExercisesFor } from "@/lib/queries";
import { createExerciseAction } from "@/app/actions/workout";
import { ExerciseLibrary } from "@/components/exercise-library-list";

export default async function ExercisesPage() {
  const user = await requireUser();
  const exercises = await listExercisesFor(user.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lifts</h1>
        <p className="mt-1 text-sm text-ink-400">
          {exercises.length} available. Tap one to see your history and records.
        </p>
      </div>

      <details className="card overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-200">
          Add your own lift
        </summary>

        <form action={createExerciseAction} className="space-y-3 border-t border-ink-800 p-4">
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" required className="field" placeholder="Zercher Squat" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="muscleGroup">
                Muscle group
              </label>
              <input
                id="muscleGroup"
                name="muscleGroup"
                required
                className="field"
                placeholder="quads"
              />
            </div>
            <div>
              <label className="label" htmlFor="equipment">
                Equipment
              </label>
              <input
                id="equipment"
                name="equipment"
                required
                className="field"
                placeholder="barbell"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="modality">
              What do you track?
            </label>
            <select id="modality" name="modality" className="field" defaultValue="weight_reps">
              <option value="weight_reps">Weight and reps</option>
              <option value="bodyweight">Reps only</option>
              <option value="weighted_bodyweight">Bodyweight plus added weight</option>
              <option value="cardio">Time, distance, calories</option>
              <option value="time">Time only</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full">
            Add lift
          </button>
        </form>
      </details>

      <ExerciseLibrary exercises={exercises} />
    </div>
  );
}
