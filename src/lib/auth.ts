import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { authSessions, users, type User } from "@/db/schema";

const COOKIE = "fit_session";
const SESSION_DAYS = 60;

/* ------------------------------------------------------------ passwords */

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/* ------------------------------------------------------------- sessions */

/**
 * The cookie carries a random token; the database stores only its SHA-256.
 * A leaked database dump therefore cannot be replayed as a live session.
 */
function tokenToId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);

  await db.insert(authSessions).values({ id: tokenToId(token), userId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(authSessions).where(eq(authSessions.id, tokenToId(token)));
  jar.delete(COOKIE);
}

/** Returns the signed-in user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, tokenToId(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(authSessions).where(eq(authSessions.id, tokenToId(token)));
    return null;
  }

  return row.user;
}

/** Use in any page or action that must not run for a signed-out visitor. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

/** Housekeeping; call occasionally rather than on every request. */
export async function purgeExpiredSessions() {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
}

/* --------------------------------------------------------------- invites */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1

export function generateInviteCode(length = 10) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Constant-time compare so a code cannot be guessed character by character. */
export function codesMatch(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
