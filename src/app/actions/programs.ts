"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  exercises,
  routineAssignments,
  routineBlocks,
  routineDays,
  routineItems,
  routines,
  users,
  workoutExercises,
  workouts,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canEditRoutine, getEditableRoutine } from "@/lib/access";
import { routineIdForBlock, routineIdForDay, routineIdForItem } from "@/lib/programs";

export type FormState = { error?: string; notice?: string };

/** Throws unless the caller may edit the program this id belongs to. */
async function assertEditable(userId: string, routineId: string | null) {
  if (!routineId || !(await canEditRoutine(userId, routineId))) {
    throw new Error("NOT_FOUND");
  }
  return routineId;
}

async function nextPosition(table: "days" | "blocks" | "items", parentId: string) {
  if (table === "days") {
    const [r] = await db
      .select({ next: sql<number>`coalesce(max(${routineDays.position}), -1) + 1` })
      .from(routineDays)
      .where(eq(routineDays.routineId, parentId));
    return r.next;
  }
  if (table === "blocks") {
    const [r] = await db
      .select({ next: sql<number>`coalesce(max(${routineBlocks.position}), -1) + 1` })
      .from(routineBlocks)
      .where(eq(routineBlocks.routineDayId, parentId));
    return r.next;
  }
  const [r] = await db
    .select({ next: sql<number>`coalesce(max(${routineItems.position}), -1) + 1` })
    .from(routineItems)
    .where(eq(routineItems.blockId, parentId));
  return r.next;
}

/* -------------------------------------------------------------- programs */

export async function createProgramAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "New program";
  const description = String(formData.get("description") ?? "").trim() || null;

  const [routine] = await db
    .insert(routines)
    .values({ ownerId: user.id, name, description })
    .returning({ id: routines.id });

  redirect(`/programs/${routine.id}`);
}

export async function renameProgramAction(formData: FormData) {
  const user = await requireUser();
  const routineId = String(formData.get("routineId"));
  await assertEditable(user.id, routineId);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;

  await db.update(routines).set({ name, description }).where(eq(routines.id, routineId));
  revalidatePath(`/programs/${routineId}`);
}

export async function archiveProgramAction(formData: FormData) {
  const user = await requireUser();
  const routineId = String(formData.get("routineId"));

  // Only the author can retire a program outright; an assignee editing
  // their copy should not be able to delete the coach's work.
  const [routine] = await db.select().from(routines).where(eq(routines.id, routineId)).limit(1);
  if (!routine || routine.ownerId !== user.id) throw new Error("NOT_FOUND");

  await db.delete(routines).where(eq(routines.id, routineId));
  revalidatePath("/programs");
  redirect("/programs");
}

/* ------------------------------------------------------------------ days */

export async function addDayAction(formData: FormData) {
  const user = await requireUser();
  const routineId = String(formData.get("routineId"));
  await assertEditable(user.id, routineId);

  const raw = formData.get("weekday");
  const weekday = raw === "" || raw == null ? null : Number(raw);
  const name = String(formData.get("name") ?? "").trim() || "New day";

  await db.insert(routineDays).values({
    routineId,
    name,
    weekday: weekday != null && weekday >= 0 && weekday <= 6 ? weekday : null,
    position: await nextPosition("days", routineId),
  });

  revalidatePath(`/programs/${routineId}`);
}

export async function deleteDayAction(formData: FormData) {
  const user = await requireUser();
  const dayId = String(formData.get("dayId"));
  const routineId = await assertEditable(user.id, await routineIdForDay(dayId));

  await db.delete(routineDays).where(eq(routineDays.id, dayId));
  revalidatePath(`/programs/${routineId}`);
}

/* ---------------------------------------------------------------- blocks */

export async function addBlockAction(formData: FormData) {
  const user = await requireUser();
  const dayId = String(formData.get("dayId"));
  const routineId = await assertEditable(user.id, await routineIdForDay(dayId));

  const position = await nextPosition("blocks", dayId);
  const fallback = `Block ${String.fromCharCode(65 + position)}`; // A, B, C...
  const name = String(formData.get("name") ?? "").trim() || fallback;
  const focus = String(formData.get("focus") ?? "").trim() || null;

  await db.insert(routineBlocks).values({ routineDayId: dayId, name, focus, position });
  revalidatePath(`/programs/${routineId}/day/${dayId}`);
}

export async function updateBlockAction(formData: FormData) {
  const user = await requireUser();
  const blockId = String(formData.get("blockId"));
  const routineId = await assertEditable(user.id, await routineIdForBlock(blockId));

  const name = String(formData.get("name") ?? "").trim();
  const focus = String(formData.get("focus") ?? "").trim() || null;
  if (!name) return;

  await db.update(routineBlocks).set({ name, focus }).where(eq(routineBlocks.id, blockId));
  revalidatePath(`/programs/${routineId}`);
}

export async function deleteBlockAction(formData: FormData) {
  const user = await requireUser();
  const blockId = String(formData.get("blockId"));
  const dayId = String(formData.get("dayId"));
  const routineId = await assertEditable(user.id, await routineIdForBlock(blockId));

  await db.delete(routineBlocks).where(eq(routineBlocks.id, blockId));
  revalidatePath(`/programs/${routineId}/day/${dayId}`);
}

/* ----------------------------------------------------------------- items */

const itemSchema = z.object({
  targetSets: z.coerce.number().int().min(1).max(20).catch(3),
  targetReps: z.string().trim().min(1).max(12).catch("8"),
  targetRpe: z.coerce.number().min(1).max(10).nullable().catch(null),
  notes: z.string().trim().max(200).nullable().catch(null),
});

export async function addItemAction(formData: FormData) {
  const user = await requireUser();
  const blockId = String(formData.get("blockId"));
  const dayId = String(formData.get("dayId"));
  const routineId = await assertEditable(user.id, await routineIdForBlock(blockId));

  const exerciseId = String(formData.get("exerciseId"));
  const rpeRaw = String(formData.get("targetRpe") ?? "").trim();

  const parsed = itemSchema.parse({
    targetSets: formData.get("targetSets"),
    targetReps: formData.get("targetReps"),
    targetRpe: rpeRaw === "" ? null : rpeRaw,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  await db.insert(routineItems).values({
    blockId,
    exerciseId,
    position: await nextPosition("items", blockId),
    ...parsed,
  });

  revalidatePath(`/programs/${routineId}/day/${dayId}`);
}

export async function updateItemAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId"));
  const routineId = await assertEditable(user.id, await routineIdForItem(itemId));

  const rpeRaw = String(formData.get("targetRpe") ?? "").trim();
  const parsed = itemSchema.parse({
    targetSets: formData.get("targetSets"),
    targetReps: formData.get("targetReps"),
    targetRpe: rpeRaw === "" ? null : rpeRaw,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  await db.update(routineItems).set(parsed).where(eq(routineItems.id, itemId));
  revalidatePath(`/programs/${routineId}`);
}

export async function deleteItemAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId"));
  const dayId = String(formData.get("dayId"));
  const routineId = await assertEditable(user.id, await routineIdForItem(itemId));

  await db.delete(routineItems).where(eq(routineItems.id, itemId));
  revalidatePath(`/programs/${routineId}/day/${dayId}`);
}

/* ----------------------------------------------------------- assignments */

export async function assignProgramAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const routineId = String(formData.get("routineId"));

  const routine = await getEditableRoutine(user.id, routineId);
  if (!routine) return { error: "You cannot assign this program." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const [target] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!target) return { error: "Nobody with that email has an account." };

  await db
    .insert(routineAssignments)
    .values({ routineId, userId: target.id, assignedBy: user.id })
    .onConflictDoNothing();

  revalidatePath(`/programs/${routineId}`);
  return { notice: `${target.name} is now running this program.` };
}

export async function unassignProgramAction(formData: FormData) {
  const user = await requireUser();
  const routineId = String(formData.get("routineId"));
  const userId = String(formData.get("userId"));

  const routine = await getEditableRoutine(user.id, routineId);
  if (!routine) throw new Error("NOT_FOUND");

  await db
    .delete(routineAssignments)
    .where(
      and(eq(routineAssignments.routineId, routineId), eq(routineAssignments.userId, userId)),
    );

  revalidatePath(`/programs/${routineId}`);
}

/* --------------------------------------------------- starting a session */

/**
 * Opens a workout from a programmed day: every exercise in every block,
 * in order, already added to the session.
 *
 * The block name is copied onto each entry rather than referenced, so the
 * logged session still reads correctly after the program is edited.
 */
export async function startFromDayAction(formData: FormData) {
  const user = await requireUser();
  const dayId = String(formData.get("dayId"));

  const routineId = await routineIdForDay(dayId);
  if (!routineId || !(await canEditRoutine(user.id, routineId))) throw new Error("NOT_FOUND");

  const [day] = await db.select().from(routineDays).where(eq(routineDays.id, dayId)).limit(1);
  if (!day) throw new Error("NOT_FOUND");

  const planned = await db
    .select({
      exerciseId: routineItems.exerciseId,
      blockName: routineBlocks.name,
      blockPosition: routineBlocks.position,
      itemPosition: routineItems.position,
    })
    .from(routineBlocks)
    .innerJoin(routineItems, eq(routineItems.blockId, routineBlocks.id))
    .where(eq(routineBlocks.routineDayId, dayId))
    .orderBy(asc(routineBlocks.position), asc(routineItems.position));

  const workoutId = await db.transaction(async (tx) => {
    const [workout] = await tx
      .insert(workouts)
      .values({ userId: user.id, routineDayId: dayId, name: day.name })
      .returning({ id: workouts.id });

    if (planned.length > 0) {
      await tx.insert(workoutExercises).values(
        planned.map((p, i) => ({
          workoutId: workout.id,
          exerciseId: p.exerciseId,
          position: i,
          blockName: p.blockName,
        })),
      );
    }

    return workout.id;
  });

  revalidatePath("/today");
  redirect(`/workout/${workoutId}`);
}

/** Adds a custom exercise straight from the program editor. */
export async function createExerciseInlineAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const muscleGroup = String(formData.get("muscleGroup") ?? "").trim() || "other";
  const equipment = String(formData.get("equipment") ?? "").trim() || "other";
  if (name.length < 2) return;

  await db.insert(exercises).values({ name, muscleGroup, equipment, ownerId: user.id });
  revalidatePath("/exercises");
}
