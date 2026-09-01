import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accessGrants,
  users,
  workouts,
  routines,
  routineAssignments,
} from "@/db/schema";

/**
 * Every cross-user read in the app goes through this file.
 *
 * The rule: a user sees their own data, and sees another user's data only
 * if that user has an active row in access_grants naming them as viewer.
 * There is no admin bypass - being able to create accounts does not mean
 * being able to read what people lift.
 */

export class AccessError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "AccessError";
  }
}

export async function canView(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;

  const [grant] = await db
    .select({ id: accessGrants.id })
    .from(accessGrants)
    .where(and(eq(accessGrants.ownerId, ownerId), eq(accessGrants.viewerId, viewerId)))
    .limit(1);

  return Boolean(grant);
}

export async function assertCanView(viewerId: string, ownerId: string): Promise<void> {
  if (!(await canView(viewerId, ownerId))) throw new AccessError();
}

/** People who have granted me access - the "Crew" list. */
export async function listVisibleTo(viewerId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      grantedAt: accessGrants.createdAt,
    })
    .from(accessGrants)
    .innerJoin(users, eq(users.id, accessGrants.ownerId))
    .where(eq(accessGrants.viewerId, viewerId));
}

/** People I have given access to my log - shown in Settings so it is revocable. */
export async function listViewersOf(ownerId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      grantedAt: accessGrants.createdAt,
    })
    .from(accessGrants)
    .innerJoin(users, eq(users.id, accessGrants.viewerId))
    .where(eq(accessGrants.ownerId, ownerId));
}

export async function grantAccess(ownerId: string, viewerId: string) {
  if (ownerId === viewerId) return;
  await db.insert(accessGrants).values({ ownerId, viewerId }).onConflictDoNothing();
}

export async function revokeAccess(ownerId: string, viewerId: string) {
  await db
    .delete(accessGrants)
    .where(and(eq(accessGrants.ownerId, ownerId), eq(accessGrants.viewerId, viewerId)));
}

/* ------------------------------------------------- ownership shortcuts */

/**
 * Loads a workout only if the viewer is allowed to see it. Returns null
 * rather than throwing so pages can render a plain 404 - not found and
 * not permitted look identical, which avoids leaking that a workout exists.
 */
export async function getViewableWorkout(viewerId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, workoutId))
    .limit(1);

  if (!workout) return null;
  if (!(await canView(viewerId, workout.userId))) return null;
  return workout;
}

/** Workouts may only be edited by their owner, never by a granted viewer. */
export async function getEditableWorkout(userId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);

  return workout ?? null;
}

/* -------------------------------------------------------------- programs */

/**
 * A program is editable by the person who wrote it and by anyone it has
 * been assigned to. Prescribed training is a starting point, so an athlete
 * can swap an exercise or change a rep target without going back to the
 * coach.
 */
export async function canEditRoutine(userId: string, routineId: string): Promise<boolean> {
  const [row] = await db
    .select({ ownerId: routines.ownerId, assignedTo: routineAssignments.userId })
    .from(routines)
    .leftJoin(
      routineAssignments,
      and(
        eq(routineAssignments.routineId, routines.id),
        eq(routineAssignments.userId, userId),
      ),
    )
    .where(eq(routines.id, routineId))
    .limit(1);

  if (!row) return false;
  return row.ownerId === userId || row.assignedTo === userId;
}

/** Loads a program only if the caller may edit it, else null (reads as 404). */
export async function getEditableRoutine(userId: string, routineId: string) {
  if (!(await canEditRoutine(userId, routineId))) return null;
  const [routine] = await db.select().from(routines).where(eq(routines.id, routineId)).limit(1);
  return routine ?? null;
}

/**
 * Every program the user can run: ones they wrote, and ones assigned to
 * them by somebody else.
 */
export async function listRoutinesFor(userId: string) {
  const owned = await db
    .select({ routine: routines, authorName: users.name, assigned: sql<boolean>`false` })
    .from(routines)
    .innerJoin(users, eq(users.id, routines.ownerId))
    .where(and(eq(routines.ownerId, userId), isNull(routines.archivedAt)));

  const assigned = await db
    .select({ routine: routines, authorName: users.name, assigned: sql<boolean>`true` })
    .from(routineAssignments)
    .innerJoin(routines, eq(routines.id, routineAssignments.routineId))
    .innerJoin(users, eq(users.id, routines.ownerId))
    .where(and(eq(routineAssignments.userId, userId), isNull(routines.archivedAt)));

  // A program you wrote for yourself and also assigned to yourself should
  // only appear once.
  const seen = new Set(owned.map((r) => r.routine.id));
  return [...owned, ...assigned.filter((r) => !seen.has(r.routine.id))];
}

/** Who a program has been handed to, for the author's management screen. */
export async function listRoutineAssignees(routineId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      assignedAt: routineAssignments.createdAt,
    })
    .from(routineAssignments)
    .innerJoin(users, eq(users.id, routineAssignments.userId))
    .where(eq(routineAssignments.routineId, routineId));
}
