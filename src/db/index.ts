import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Next dev reloads modules on every edit; without this the process leaks a
 * new pool per reload until Postgres refuses connections.
 */
const globalForDb = globalThis as unknown as {
  __fitClient?: postgres.Sql;
  __fitDb?: Database;
};

/**
 * The connection is opened on first query, never at import.
 *
 * Next imports every route module during `next build` to collect its
 * config, and the build has no database: on App Platform DATABASE_URL is
 * still the literal "${db.DATABASE_URL}" binding until the container
 * actually runs. Connecting as an import side effect turns that into a
 * build failure in a route that has nothing to do with the database.
 */
function getDb(): Database {
  if (globalForDb.__fitDb) return globalForDb.__fitDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const client =
    globalForDb.__fitClient ??
    postgres(connectionString, {
      max: process.env.NODE_ENV === "production" ? 10 : 3,
      // DigitalOcean Managed Postgres terminates non-TLS connections.
      ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
    });

  const instance = drizzle(client, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__fitClient = client;
    globalForDb.__fitDb = instance;
  }

  return instance;
}

/**
 * Stands in for the real drizzle instance so every call site can keep
 * importing `db` directly. Methods are bound to the underlying instance so
 * drizzle's internals never see this proxy as their `this`.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb() as object, prop);
  },
});

export { schema };
