/**
 * Loads the built-in exercise library. Safe to run repeatedly - it only
 * inserts library exercises whose names are not already present, so
 * rerunning after adding to the library tops up rather than duplicating.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { isNull } from "drizzle-orm";
import { db } from "./index";
import { exercises } from "./schema";
import { EXERCISE_LIBRARY } from "./exercise-library";

async function main() {
  const existing = await db
    .select({ name: exercises.name })
    .from(exercises)
    .where(isNull(exercises.ownerId));

  const have = new Set(existing.map((e) => e.name.toLowerCase()));
  const missing = EXERCISE_LIBRARY.filter((e) => !have.has(e.name.toLowerCase()));

  if (missing.length === 0) {
    console.log(`Library is up to date (${existing.length} exercises).`);
    return;
  }

  await db.insert(exercises).values(
    missing.map((e) => ({
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
      modality: e.modality,
      ownerId: null,
    })),
  );

  console.log(`Added ${missing.length} exercises (${existing.length + missing.length} total).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
