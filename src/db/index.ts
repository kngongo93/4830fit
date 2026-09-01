import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Next dev reloads modules on every edit, which would otherwise leak a pool
 * per reload. Production keeps its singleton in the module closure below;
 * this only exists so a hot reload can find the pool the previous copy of
 * the module made.
 */
const globalForDb = globalThis as unknown as {
  __fitClient?: postgres.Sql;
  __fitDb?: Database;
};

/** The one pool for this process, whatever the environment. */
let cached: Database | undefined;

/**
 * The connection is opened on first query, never at import.
 *
 * Next imports every route module during `next build` to collect its
 * config, and the build has no database: on App Platform DATABASE_URL is
 * still the literal "${db.DATABASE_URL}" binding until the container
 * actually runs. Connecting as an import side effect turns that into a
 * build failure in a route that has nothing to do with the database.
 *
 * The result is cached unconditionally. An earlier version cached only
 * outside production, which meant production built a fresh pool on every
 * single property access of `db` and exhausted the database's connection
 * slots within minutes.
 */
function getDb(): Database {
  if (cached) return cached;
  if (globalForDb.__fitDb) {
    cached = globalForDb.__fitDb;
    return cached;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const client =
    globalForDb.__fitClient ??
    postgres(connectionString, {
      // A 1 GB managed cluster allows on the order of 25 connections in
      // total, shared with backups and any admin session, so this stays
      // well clear of the ceiling.
      max: process.env.NODE_ENV === "production" ? 8 : 3,
      // Hand connections back rather than holding them open between sets.
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 15,
      // DigitalOcean Managed Postgres terminates non-TLS connections.
      ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
    });

  cached = drizzle(client, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__fitClient = client;
    globalForDb.__fitDb = cached;
  }

  return cached;
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
