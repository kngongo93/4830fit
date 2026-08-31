import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

/**
 * Next dev reloads modules on every edit; without this the process leaks a
 * new pool per reload until Postgres refuses connections.
 */
const globalForDb = globalThis as unknown as { __fitClient?: postgres.Sql };

const client =
  globalForDb.__fitClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    // DigitalOcean Managed Postgres terminates non-TLS connections.
    ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__fitClient = client;

export const db = drizzle(client, { schema });
export { schema };
