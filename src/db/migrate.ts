/**
 * Applies pending SQL migrations from ./drizzle.
 *
 * Runs as an App Platform pre-deploy job rather than on container start:
 * a failed migration then fails the deploy and leaves the previous version
 * serving, instead of crash-looping a new one against a half-changed
 * database.
 *
 * This does not use drizzle's own migrator. That migrator unconditionally
 * issues CREATE SCHEMA IF NOT EXISTS for its bookkeeping schema, and
 * Postgres checks CREATE-on-database before honouring IF NOT EXISTS - so on
 * a managed database whose app user cannot create schemas it fails with
 * 42501 before running a single migration, and naming an existing schema
 * does not help. Applying the files directly keeps the tracking table in
 * public, where the app user can already write.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = "./drizzle";
const TRACKING_TABLE = "__fit_migrations";

type Journal = { entries: { idx: number; tag: string }[] };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // max: 1 because migrations must run in order on one connection.
  const sql = postgres(url, {
    max: 1,
    ssl: url.includes("sslmode=require") ? "require" : undefined,
  });

  try {
    await sql.unsafe(`
      create table if not exists ${TRACKING_TABLE} (
        tag text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const journalPath = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
    const journal: Journal = JSON.parse(await readFile(journalPath, "utf8"));
    const ordered = [...journal.entries].sort((a, b) => a.idx - b.idx);

    const rows = await sql.unsafe<{ tag: string }[]>(`select tag from ${TRACKING_TABLE}`);
    const applied = new Set(rows.map((r) => r.tag));

    const pending = ordered.filter((entry) => !applied.has(entry.tag));
    if (pending.length === 0) {
      console.log(`No pending migrations (${applied.size} already applied).`);
      return;
    }

    for (const entry of pending) {
      const file = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      const contents = await readFile(file, "utf8");

      // drizzle-kit separates statements with this marker rather than a
      // bare semicolon, which would split function bodies incorrectly.
      const statements = contents
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      // One transaction per file: a migration either lands whole or not at
      // all, so a failure never leaves the schema half-changed.
      await sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await tx.unsafe(`insert into ${TRACKING_TABLE} (tag) values ($1)`, [entry.tag]);
      });

      console.log(`Applied ${entry.tag} (${statements.length} statements).`);
    }

    console.log(`${pending.length} migration(s) applied.`);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
