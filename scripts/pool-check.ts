/**
 * Regression check: repeated use of `db` must reuse one connection pool.
 *
 * A version of src/db/index.ts cached the drizzle instance only outside
 * production, so the deployed app built a new pool on every property access
 * and exhausted the database within minutes of real traffic. Run with
 * NODE_ENV=production, which is the case that broke.
 *
 *   NODE_ENV=production npm run pool:check
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index";
import { exercises } from "../src/db/schema";

const LABEL = "pooltest";

async function connections() {
  const [row] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from pg_stat_activity where application_name = ${LABEL}`,
  );
  return Number((row as unknown as { n: number }).n);
}

async function main() {
  console.log("NODE_ENV:", process.env.NODE_ENV);
  await db.execute(sql`set application_name = ${sql.raw(`'${LABEL}'`)}`);

  // Hammer it the way a page render would: many separate accesses of `db`.
  for (let i = 0; i < 40; i++) {
    await db.select({ n: sql<number>`count(*)::int` }).from(exercises);
  }

  const n = await connections();
  console.log(`connections opened after 40 queries: ${n}`);
  console.log(n <= 8 ? "OK single pool" : `FAIL leaking pools (${n})`);
  process.exit(n <= 8 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
