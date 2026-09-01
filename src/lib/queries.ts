import "server-only";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  personalRecords,
  sets,
  workoutExercises,
  workouts,
  type Exercise,
  type WorkoutSet,
} from "@/db/schema";

/** The session the user is in the middle of, if any. */
export async function getActiveWorkout(userId: string) {
  const [active] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), isNull(workouts.finishedAt)))
    .orderBy(desc(workouts.startedAt))
    .limit(1);

  return active ?? null;
}

export type WorkoutEntry = {
  entryId: string;
  position: number;
  notes: string | null;
  blockName: string | null;
  exercise: Exercise;
  sets: WorkoutSet[];
};

/** A whole session: its exercises in order, each with its sets in order. */
export async function getWorkoutDetail(workoutId: string): Promise<WorkoutEntry[]> {
  const rows = await db
    .select({
      entryId: workoutExercises.id,
      position: workoutExercises.position,
      notes: workoutExercises.notes,
      blockName: workoutExercises.blockName,
      exercise: exercises,
      set: sets,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .leftJoin(sets, eq(sets.workoutExerciseId, workoutExercises.id))
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.position), asc(sets.position));

  const byEntry = new Map<string, WorkoutEntry>();
  for (const row of rows) {
    let entry = byEntry.get(row.entryId);
    if (!entry) {
      entry = {
        entryId: row.entryId,
        position: row.position,
        notes: row.notes,
        blockName: row.blockName,
        exercise: row.exercise,
        sets: [],
      };
      byEntry.set(row.entryId, entry);
    }
    if (row.set) entry.sets.push(row.set);
  }

  return [...byEntry.values()].sort((a, b) => a.position - b.position);
}

export type LastPerformance = {
  workoutId: string;
  performedAt: Date;
  sets: WorkoutSet[];
};

/**
 * The last time this user trained this exercise, ignoring the session they
 * are in right now. This is the whole point of the app: it is what the
 * logger shows above the inputs so you know what to beat.
 */
export async function getLastPerformance(
  userId: string,
  exerciseId: string,
  excludeWorkoutId?: string,
): Promise<LastPerformance | null> {
  const [previous] = await db
    .select({
      entryId: workoutExercises.id,
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workoutExercises.exerciseId, exerciseId),
        excludeWorkoutId ? ne(workouts.id, excludeWorkoutId) : undefined,
        // Only count sessions that actually recorded something. Same
        // qualification caveat as getRecentWorkouts below.
        sql`exists (select 1 from sets s where s.workout_exercise_id = workout_exercises.id)`,
      ),
    )
    .orderBy(desc(workouts.startedAt))
    .limit(1);

  if (!previous) return null;

  const previousSets = await db
    .select()
    .from(sets)
    .where(eq(sets.workoutExerciseId, previous.entryId))
    .orderBy(asc(sets.position));

  return {
    workoutId: previous.workoutId,
    performedAt: previous.startedAt,
    sets: previousSets,
  };
}

/** Recent sessions for the history list. */
export async function getRecentWorkouts(userId: string, limit = 30) {
  return db
    .select({
      id: workouts.id,
      name: workouts.name,
      startedAt: workouts.startedAt,
      finishedAt: workouts.finishedAt,
      // Table names are written out rather than interpolated: drizzle renders
      // an interpolated column unqualified, which is ambiguous the moment a
      // correlated subquery joins a second table that also has an "id".
      exerciseCount: sql<number>`(
        select count(*)::int from workout_exercises we
        where we.workout_id = workouts.id
      )`,
      setCount: sql<number>`(
        select count(*)::int from sets s
        join workout_exercises we on we.id = s.workout_exercise_id
        where we.workout_id = workouts.id
      )`,
      volume: sql<number>`coalesce((
        select sum(s.weight * s.reps) from sets s
        join workout_exercises we on we.id = s.workout_exercise_id
        where we.workout_id = workouts.id and s.is_warmup = false
      ), 0)`,
    })
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.startedAt))
    .limit(limit);
}

/** Everything the picker offers: the shared library plus the user's own. */
export async function listExercisesFor(userId: string) {
  return db
    .select()
    .from(exercises)
    .where(or(isNull(exercises.ownerId), eq(exercises.ownerId, userId)))
    .orderBy(asc(exercises.name));
}

export async function getPersonalRecords(userId: string, exerciseId: string) {
  return db
    .select()
    .from(personalRecords)
    .where(
      and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, exerciseId)),
    );
}
