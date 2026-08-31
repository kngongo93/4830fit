"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, requireAdmin, requireUser } from "@/lib/auth";

export type FormState = { error?: string; notice?: string };

/** True only while the instance has no accounts at all. */
export async function noUsersYet(): Promise<boolean> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return row.count === 0;
}

const accountSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(60),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(10, "Password must be at least 10 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

/* --------------------------------------------------------------- setup */

/**
 * Creates the very first account, which is an admin, and signs them in.
 *
 * Only reachable while the users table is empty. The check is repeated
 * inside the write so two people opening /setup at the same moment cannot
 * both create an admin - the insert is conditional on the count still
 * being zero, and the loser gets an error rather than a second account.
 */
export async function createFirstAdminAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await noUsersYet())) {
    return { error: "Setup has already been completed." };
  }

  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  // The WHERE NOT EXISTS is the actual guard: the row is only written if the
  // table is still empty at write time, so a second request racing this one
  // inserts nothing and falls through to the error below.
  const created = await db.execute<{ id: string }>(sql`
    insert into users (name, email, password_hash, role)
    select ${name}, ${email}, ${passwordHash}, 'admin'
    where not exists (select 1 from users)
    returning id
  `);

  const rows = created as unknown as { id: string }[];
  if (rows.length === 0) {
    return { error: "Setup has already been completed." };
  }

  await createSession(rows[0].id);
  redirect("/today");
}

/* ------------------------------------------------------- managing users */

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;
  const role = formData.get("role") === "admin" ? "admin" : "member";

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "An account already exists for that email." };

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ name, email, passwordHash, role });

  revalidatePath("/admin");
  return { notice: `Created ${name}. Give them the email and password you just set.` };
}

/**
 * Deleting an account removes everything that user logged - the schema
 * cascades from users through workouts to sets. There is no undo, which is
 * why the UI asks for the email to be typed rather than offering a button.
 */
export async function deleteUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId"));
  const typed = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();

  if (userId === admin.id) {
    return { error: "You cannot delete your own account." };
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "That account no longer exists." };

  if (typed !== target.email.toLowerCase()) {
    return { error: "Type the exact email address to confirm deletion." };
  }

  // Never leave the instance with no way back in.
  if (target.role === "admin") {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));
    if (row.count <= 1) return { error: "That is the only admin account." };
  }

  await db.delete(users).where(eq(users.id, userId));

  revalidatePath("/admin");
  return { notice: `Deleted ${target.name} and everything they logged.` };
}

export async function setUserRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (userId === admin.id) return;

  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin");
}

/** Lets a signed-in user change their own password. */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10) return { error: "Password must be at least 10 characters" };
  if (password !== confirm) return { error: "Passwords do not match" };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { notice: "Password updated." };
}
