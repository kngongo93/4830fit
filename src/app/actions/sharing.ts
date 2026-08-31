"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { requireUser, requireAdmin, generateInviteCode } from "@/lib/auth";
import { grantAccess, revokeAccess } from "@/lib/access";

export type FormState = { error?: string; notice?: string };

/* -------------------------------------------------------------- sharing */

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");

/**
 * Share my log with someone. Deliberately one-way: this gives them read
 * access to me and gives me nothing of theirs.
 */
export async function grantAccessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data;
  if (email === me.email) return { error: "That is your own account." };

  const [target] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!target) {
    return { error: "Nobody with that email has an account yet. Invite them first." };
  }

  await grantAccess(me.id, target.id);
  revalidatePath("/settings");

  return { notice: `${target.name} can now see your training log.` };
}

export async function revokeAccessAction(formData: FormData) {
  const me = await requireUser();
  const viewerId = String(formData.get("viewerId"));

  await revokeAccess(me.id, viewerId);
  revalidatePath("/settings");
  revalidatePath("/crew");
}

/* -------------------------------------------------------------- invites */

export async function createInviteAction(formData: FormData) {
  const admin = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim() || null;
  const maxUses = Math.min(Math.max(Number(formData.get("maxUses")) || 1, 1), 50);

  // Expire in 14 days so a link pasted into a group chat does not stay
  // live forever.
  const expiresAt = new Date(Date.now() + 14 * 864e5);

  await db.insert(invites).values({
    code: generateInviteCode(),
    createdBy: admin.id,
    label,
    maxUses,
    expiresAt,
  });

  revalidatePath("/settings");
}

export async function revokeInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const inviteId = String(formData.get("inviteId"));

  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.createdBy, admin.id)));

  revalidatePath("/settings");
}

/* ---------------------------------------------------------- preferences */

export async function setUnitsAction(formData: FormData) {
  const me = await requireUser();
  const units = formData.get("units") === "kg" ? "kg" : "lb";

  await db.update(users).set({ units }).where(eq(users.id, me.id));

  revalidatePath("/settings");
  revalidatePath("/today");
}
