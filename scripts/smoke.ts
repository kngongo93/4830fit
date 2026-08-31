import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db/index";
import { users, accessGrants } from "../src/db/schema";
import {
  canView,
  grantAccess,
  revokeAccess,
  listVisibleTo,
} from "../src/lib/access";
import {
  estimateOneRepMax,
  suggestNext,
  platesFor,
  toDisplayWeight,
  toStoredWeight,
} from "../src/lib/training";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok ? "" : `\n         got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
}

async function main() {
  console.log("\n--- training math ---");
  check("1 rep max of a single is the weight", estimateOneRepMax(315, 1), 315);
  check("225x5 e1RM", estimateOneRepMax(225, 5), 262.5);
  check("zero reps is zero", estimateOneRepMax(225, 0), 0);

  check(
    "easy set earns a double jump",
    suggestNext([{ weight: 185, reps: 5, rpe: 7, isWarmup: false }], { targetReps: 5 }).weight,
    195,
  );
  check(
    "grinder repeats the weight",
    suggestNext([{ weight: 185, reps: 5, rpe: 9.5, isWarmup: false }], { targetReps: 5 }).weight,
    185,
  );
  check(
    "rpe 8.5 adds a rep not weight",
    suggestNext([{ weight: 185, reps: 5, rpe: 8.5, isWarmup: false }], { targetReps: 5 }).reps,
    6,
  );
  check(
    "no rpe, hit target -> add weight",
    suggestNext([{ weight: 185, reps: 5, rpe: null, isWarmup: false }], { targetReps: 5 }).weight,
    190,
  );
  check(
    "no rpe, missed target -> repeat",
    suggestNext([{ weight: 185, reps: 3, rpe: null, isWarmup: false }], { targetReps: 5 }).weight,
    185,
  );
  check(
    "warmups are ignored when picking the top set",
    suggestNext(
      [
        { weight: 315, reps: 1, rpe: null, isWarmup: true },
        { weight: 185, reps: 5, rpe: null, isWarmup: false },
      ],
      { targetReps: 5 },
    ).weight,
    190,
  );
  check("first time gives no suggestion", suggestNext([]).weight, null);

  // platesFor returns plates for ONE side of the bar.
  check("225 on a barbell", platesFor(225).plates, [45, 45]);
  check("135 on a barbell", platesFor(135).plates, [45]);
  check("245 mixes plate sizes", platesFor(245).plates, [45, 45, 10]);
  check("empty bar", platesFor(45).plates, []);
  check("below bar weight", platesFor(30).plates, []);
  check("unreachable weight flagged", platesFor(226).exact, false);

  const kg = toDisplayWeight(225, "kg");
  check("lb -> kg -> lb round trips", toStoredWeight(kg, "kg")! > 224.9, true);

  console.log("\n--- access model ---");
  const made = await db
    .insert(users)
    .values([
      { name: "Smoke A", email: "smoke-a@test.local", passwordHash: "x" },
      { name: "Smoke B", email: "smoke-b@test.local", passwordHash: "x" },
    ])
    .returning({ id: users.id });
  const [a, b] = made;

  check("nobody can read anyone by default", await canView(b.id, a.id), false);
  check("you can always read yourself", await canView(a.id, a.id), true);

  await grantAccess(a.id, b.id);
  check("grant lets B read A", await canView(b.id, a.id), true);
  check("grant is one-way, A still cannot read B", await canView(a.id, b.id), false);

  await grantAccess(a.id, b.id);
  const dupes = await db.select().from(accessGrants).where(eq(accessGrants.ownerId, a.id));
  check("granting twice does not duplicate", dupes.length, 1);

  check("crew list shows A for B", (await listVisibleTo(b.id)).map((v) => v.name), ["Smoke A"]);

  await grantAccess(a.id, a.id);
  const selfGrant = await db.select().from(accessGrants).where(eq(accessGrants.viewerId, a.id));
  check("cannot grant yourself a row", selfGrant.length, 0);

  await revokeAccess(a.id, b.id);
  check("revoke is immediate", await canView(b.id, a.id), false);
  check("crew list empties after revoke", (await listVisibleTo(b.id)).length, 0);

  await db.delete(users).where(inArray(users.id, [a.id, b.id]));
  const left = await db.select().from(users).where(inArray(users.id, [a.id, b.id]));
  check("test users cleaned up", left.length, 0);

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
