"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { exercises, personalRecords, sets, workoutExercises, workouts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getEditableWorkout } from "@/lib/access";
import { estimateOneRepMax } from "@/lib/training";

/* ------------------------------------------------------------- sessions */

export async function startWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || defaultWorkoutName();

  const [workout] = await db
    .insert(workouts)
    .values({ userId: user.id, name })
    .returning({ id: workouts.id });

  redirect(`/workout/${workout.id}`);
}

function defaultWorkoutName() {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return `${day} workout`;
}

export async function finishWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));

  const workout = await getEditableWorkout(user.id, workoutId);
  if (!workout) throw new Error("NOT_FOUND");

  await db
    .update(workouts)
    .set({ finishedAt: new Date() })
    .where(eq(workouts.id, workoutId));

  revalidatePath("/today");
  revalidatePath("/history");
  redirect("/today");
}

export async function discardWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));

  const workout = await getEditableWorkout(user.id, workoutId);
  if (!workout) throw new Error("NOT_FOUND");

  await db.delete(workouts).where(eq(workouts.id, workoutId));

  revalidatePath("/today");
  redirect("/today");
}

/* ------------------------------------------------- exercises in session */

export async function addExerciseAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));
  const exerciseId = String(formData.get("exerciseId"));

  const workout = await getEditableWorkout(user.id, workoutId);
  if (!workout) throw new Error("NOT_FOUND");

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${workoutExercises.position}), -1) + 1` })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));

  await db.insert(workoutExercises).values({ workoutId, exerciseId, position: next });

  revalidatePath(`/workout/${workoutId}`);
}

export async function removeExerciseAction(formData: FormData) {
  const user = await requireUser();
  const entryId = String(formData.get("entryId"));

  const workoutId = await workoutIdForEntry(user.id, entryId);
  await db.delete(workoutExercises).where(eq(workoutExercises.id, entryId));

  revalidatePath(`/workout/${workoutId}`);
}

/* -------------------------------------------------------------- logging */

const setSchema = z.object({
  entryId: z.string().uuid(),
  weight: z.coerce.number().min(0).max(2000).nullable().catch(null),
  reps: z.coerce.number().int().min(0).max(1000).nullable().catch(null),
  rpe: z.coerce.number().min(1).max(10).nullable().catch(null),
  durationSec: z.coerce.number().int().min(0).max(86400).nullable().catch(null),
  distanceM: z.coerce.number().min(0).nullable().catch(null),
  calories: z.coerce.number().int().min(0).max(100000).nullable().catch(null),
  isWarmup: z.coerce.boolean().catch(false),
});

/** Blank strings must become null, not 0 - an empty RPE is "not recorded". */
function orNull(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

export async function logSetAction(formData: FormData) {
  const user = await requireUser();

  const parsed = setSchema.safeParse({
    entryId: formData.get("entryId"),
    weight: orNull(formData.get("weight")),
    reps: orNull(formData.get("reps")),
    rpe: orNull(formData.get("rpe")),
    durationSec: orNull(formData.get("durationSec")),
    distanceM: orNull(formData.get("distanceM")),
    calories: orNull(formData.get("calories")),
    isWarmup: formData.get("isWarmup") === "on",
  });
  if (!parsed.success) throw new Error("INVALID_SET");

  const { entryId, ...values } = parsed.data;
  const workoutId = await workoutIdForEntry(user.id, entryId);

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${sets.position}), -1) + 1` })
    .from(sets)
    .where(eq(sets.workoutExerciseId, entryId));

  const [created] = await db
    .insert(sets)
    .values({ workoutExerciseId: entryId, position: next, ...values })
    .returning({ id: sets.id });

  await refreshRecords(user.id, entryId, workoutId, created.id);
  revalidatePath(`/workout/${workoutId}`);
}

export async function deleteSetAction(formData: FormData) {
  const user = await requireUser();
  const setId = String(formData.get("setId"));

  const [row] = await db
    .select({ entryId: sets.workoutExerciseId })
    .from(sets)
    .where(eq(sets.id, setId))
    .limit(1);
  if (!row) return;

  const workoutId = await workoutIdForEntry(user.id, row.entryId);
  await db.delete(sets).where(eq(sets.id, setId));

  revalidatePath(`/workout/${workoutId}`);
}

/* -------------------------------------------------------- custom lifts */

const customExerciseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  muscleGroup: z.string().trim().min(1).max(40),
  equipment: z.string().trim().min(1).max(40),
  modality: z.enum(["weight_reps", "bodyweight", "weighted_bodyweight", "cardio", "time"]),
});

export async function createExerciseAction(formData: FormData) {
  const user = await requireUser();

  const parsed = customExerciseSchema.safeParse({
    name: formData.get("name"),
    muscleGroup: formData.get("muscleGroup"),
    equipment: formData.get("equipment"),
    modality: formData.get("modality"),
  });
  if (!parsed.success) throw new Error("INVALID_EXERCISE");

  await db.insert(exercises).values({ ...parsed.data, ownerId: user.id });
  revalidatePath("/exercises");
}

/* ------------------------------------------------------------ internals */

/**
 * Resolves an entry to its workout while proving the caller owns it.
 * Every logging action goes through this, so a forged entry id from
 * someone else's session cannot be written to.
 */
async function workoutIdForEntry(userId: string, entryId: string): Promise<string> {
  const [row] = await db
    .select({ workoutId: workoutExercises.workoutId, ownerId: workouts.userId })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(eq(workoutExercises.id, entryId))
    .limit(1);

  if (!row || row.ownerId !== userId) throw new Error("NOT_FOUND");
  return row.workoutId;
}

/**
 * Recomputes this exercise's records for the user after a set lands.
 * Only working sets count - a warmup single should never register as a PR.
 */
async function refreshRecords(
  userId: string,
  entryId: string,
  workoutId: string,
  setId: string,
) {
  const [entry] = await db
    .select({ exerciseId: workoutExercises.exerciseId })
    .from(workoutExercises)
    .where(eq(workoutExercises.id, entryId))
    .limit(1);
  if (!entry) return;

  const [set] = await db.select().from(sets).where(eq(sets.id, setId)).limit(1);
  if (!set || set.isWarmup) return;

  const candidates: { type: PrType; value: number }[] = [];

  if (set.weight != null && set.reps != null && set.reps > 0) {
    candidates.push({ type: "heaviest_weight", value: set.weight });
    candidates.push({ type: "best_e1rm", value: estimateOneRepMax(set.weight, set.reps) });
    candidates.push({ type: "best_volume", value: set.weight * set.reps });
  }
  if (set.weight == null && set.reps != null && set.reps > 0) {
    candidates.push({ type: "best_reps", value: set.reps });
  }
  if (set.distanceM != null && set.distanceM > 0) {
    candidates.push({ type: "best_distance", value: set.distanceM });
  }
  if (set.durationSec != null && set.durationSec > 0) {
    candidates.push({ type: "best_duration", value: set.durationSec });
  }

  for (const candidate of candidates) {
    await db
      .insert(personalRecords)
      .values({
        userId,
        exerciseId: entry.exerciseId,
        type: candidate.type,
        value: candidate.value,
        weight: set.weight,
        reps: set.reps,
        setId: set.id,
        workoutId,
        achievedAt: set.completedAt,
      })
      .onConflictDoUpdate({
        target: [
          personalRecords.userId,
          personalRecords.exerciseId,
          personalRecords.type,
        ],
        set: {
          value: candidate.value,
          weight: set.weight,
          reps: set.reps,
          setId: set.id,
          workoutId,
          achievedAt: set.completedAt,
        },
        // Only overwrite when the new attempt actually beats the record.
        setWhere: sql`${personalRecords.value} < ${candidate.value}`,
      });
  }
}

type PrType =
  | "heaviest_weight"
  | "best_e1rm"
  | "best_volume"
  | "best_reps"
  | "best_distance"
  | "best_duration";
