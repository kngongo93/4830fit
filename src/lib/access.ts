import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accessGrants, users, workouts, routines } from "@/db/schema";

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

/**
 * Routines the viewer can open: their own, plus "crew"-visible routines
 * belonging to people who granted them access.
 */
export async function listAccessibleRoutines(viewerId: string) {
  const visible = await listVisibleTo(viewerId);
  const ownerIds = [viewerId, ...visible.map((v) => v.id)];

  const rows = await db
    .select({
      routine: routines,
      ownerName: users.name,
    })
    .from(routines)
    .innerJoin(users, eq(users.id, routines.ownerId))
    .where(inArray(routines.ownerId, ownerIds));

  return rows.filter(
    (r) => r.routine.ownerId === viewerId || r.routine.visibility === "crew",
  );
}
