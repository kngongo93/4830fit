import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness only. Deliberately does not touch the database: if Postgres
 * blips, restarting the web container does not fix it and failing the
 * health check would take the app down on top of it.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
