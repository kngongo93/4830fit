"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, or, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, invites } from "@/db/schema";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  codesMatch,
} from "@/lib/auth";

export type FormState = { error?: string };

/**
 * Crude in-process throttle on password guessing. One app instance means
 * one counter, which is the right scale for a gym crew; if this ever runs
 * on multiple instances it needs to move into Postgres.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;

function throttled(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

function clearThrottle(key: string) {
  attempts.delete(key);
}

/* ------------------------------------------------------------- sign in */

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  if (throttled(`login:${email}`)) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Same message either way, so this cannot be used to discover who has an account.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return { error: "Email or password is incorrect." };
  }

  clearThrottle(`login:${email}`);
  await createSession(user.id);
  redirect("/today");
}

/* ------------------------------------------------------------ sign out */

export async function signOutAction() {
  await destroySession();
  redirect("/login");
}

/* -------------------------------------------------------- accept invite */

const joinSchema = z
  .object({
    code: z.string().trim().min(1),
    name: z.string().trim().min(1, "Enter your name").max(60),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(10, "Password must be at least 10 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export async function acceptInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = joinSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { code, name, email, password } = parsed.data;

  if (throttled(`join:${code}`)) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const [invite] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.code, code),
        isNull(invites.revokedAt),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
      ),
    )
    .limit(1);

  if (!invite || !codesMatch(invite.code, code) || invite.usedCount >= invite.maxUses) {
    return { error: "That invite link is not valid any more." };
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { error: "An account already exists for that email." };
  }

  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      // Re-check the use count inside the transaction so two people opening
      // the same single-use link cannot both get through.
      const claimed = await tx
        .update(invites)
        .set({ usedCount: sql`${invites.usedCount} + 1` })
        .where(and(eq(invites.id, invite.id), sql`${invites.usedCount} < ${invites.maxUses}`))
        .returning({ id: invites.id });

      if (claimed.length === 0) throw new Error("INVITE_EXHAUSTED");

      const [created] = await tx
        .insert(users)
        .values({ name, email, passwordHash, role: "member" })
        .returning({ id: users.id });

      return created.id;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_EXHAUSTED") {
      return { error: "That invite link has already been used." };
    }
    return { error: "Could not create the account. Try again." };
  }

  clearThrottle(`join:${code}`);
  await createSession(userId);
  redirect("/today");
}
