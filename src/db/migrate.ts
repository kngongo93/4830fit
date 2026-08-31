/**
 * Applies pending SQL migrations from ./drizzle.
 *
 * Runs as an App Platform pre-deploy job rather than on container start:
 * a failed migration then fails the deploy and leaves the previous version
 * serving, instead of crash-looping a new one against a half-changed
 * database.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // max: 1 because the migrator must hold one connection for the whole run.
  const client = postgres(url, {
    max: 1,
    ssl: url.includes("sslmode=require") ? "require" : undefined,
  });

  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();

  console.log("Migrations applied.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
