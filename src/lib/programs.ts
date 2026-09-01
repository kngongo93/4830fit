import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  routineBlocks,
  routineDays,
  routineItems,
  type Exercise,
} from "@/db/schema";

/**
 * Reading and shaping programs. A program is:
 *
 *   Program -> Day ("Monday") -> Block ("Block A: chest and triceps")
 *           -> Item (an exercise with sets/reps/RPE targets)
 *
 * The block layer is what makes a written program read the way a coach
 * writes one, rather than as a flat list of lifts.
 */

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type ProgramItem = {
  id: string;
  position: number;
  targetSets: number;
  targetReps: string;
  targetRpe: number | null;
  notes: string | null;
  exercise: Exercise;
};

export type ProgramBlock = {
  id: string;
  name: string;
  focus: string | null;
  note: string | null;
  position: number;
  items: ProgramItem[];
};

export type ProgramDay = {
  id: string;
  name: string;
  weekday: number | null;
  position: number;
  blocks: ProgramBlock[];
};

/** Every day, block and item of a program, in order, in one round trip. */
export async function getProgramDays(routineId: string): Promise<ProgramDay[]> {
  const rows = await db
    .select({
      day: routineDays,
      block: routineBlocks,
      item: routineItems,
      exercise: exercises,
    })
    .from(routineDays)
    .leftJoin(routineBlocks, eq(routineBlocks.routineDayId, routineDays.id))
    .leftJoin(routineItems, eq(routineItems.blockId, routineBlocks.id))
    .leftJoin(exercises, eq(exercises.id, routineItems.exerciseId))
    .where(eq(routineDays.routineId, routineId))
    .orderBy(asc(routineDays.position), asc(routineBlocks.position), asc(routineItems.position));

  const days = new Map<string, ProgramDay>();
  const blocks = new Map<string, ProgramBlock>();

  for (const row of rows) {
    let day = days.get(row.day.id);
    if (!day) {
      day = {
        id: row.day.id,
        name: row.day.name,
        weekday: row.day.weekday,
        position: row.day.position,
        blocks: [],
      };
      days.set(row.day.id, day);
    }

    if (!row.block) continue;

    let block = blocks.get(row.block.id);
    if (!block) {
      block = {
        id: row.block.id,
        name: row.block.name,
        focus: row.block.focus,
        note: row.block.note,
        position: row.block.position,
        items: [],
      };
      blocks.set(row.block.id, block);
      day.blocks.push(block);
    }

    if (row.item && row.exercise) {
      block.items.push({
        id: row.item.id,
        position: row.item.position,
        targetSets: row.item.targetSets,
        targetReps: row.item.targetReps,
        targetRpe: row.item.targetRpe,
        notes: row.item.notes,
        exercise: row.exercise,
      });
    }
  }

  return [...days.values()].sort((a, b) => a.position - b.position);
}

export async function getProgramDay(dayId: string): Promise<ProgramDay | null> {
  const [day] = await db.select().from(routineDays).where(eq(routineDays.id, dayId)).limit(1);
  if (!day) return null;

  const all = await getProgramDays(day.routineId);
  return all.find((d) => d.id === dayId) ?? null;
}

/** The routine a day belongs to, for permission checks. */
export async function routineIdForDay(dayId: string): Promise<string | null> {
  const [row] = await db
    .select({ routineId: routineDays.routineId })
    .from(routineDays)
    .where(eq(routineDays.id, dayId))
    .limit(1);
  return row?.routineId ?? null;
}

export async function routineIdForBlock(blockId: string): Promise<string | null> {
  const [row] = await db
    .select({ routineId: routineDays.routineId })
    .from(routineBlocks)
    .innerJoin(routineDays, eq(routineDays.id, routineBlocks.routineDayId))
    .where(eq(routineBlocks.id, blockId))
    .limit(1);
  return row?.routineId ?? null;
}

export async function routineIdForItem(itemId: string): Promise<string | null> {
  const [row] = await db
    .select({ routineId: routineDays.routineId })
    .from(routineItems)
    .innerJoin(routineBlocks, eq(routineBlocks.id, routineItems.blockId))
    .innerJoin(routineDays, eq(routineDays.id, routineBlocks.routineDayId))
    .where(eq(routineItems.id, itemId))
    .limit(1);
  return row?.routineId ?? null;
}

export function describeDay(day: { name: string; weekday: number | null }) {
  if (day.weekday == null) return day.name;
  const label = WEEKDAYS[day.weekday];
  return day.name.toLowerCase() === label.toLowerCase() ? label : `${label} · ${day.name}`;
}
