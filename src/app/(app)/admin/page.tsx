import { notFound } from "next/navigation";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workouts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { CreateUserForm } from "@/components/create-user-form";
import { UserRow } from "@/components/user-row";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireUser();
  if (me.role !== "admin") notFound();

  const everyone = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      workoutCount: sql<number>`(
        select count(*)::int from ${workouts} where ${workouts.userId} = ${users.id}
      )`,
    })
    .from(users)
    .orderBy(asc(users.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="mt-1 text-sm text-ink-400">
          {everyone.length} {everyone.length === 1 ? "account" : "accounts"}. You can create
          accounts here, or send an invite link from Settings and let them set their own
          password.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Add someone
        </h2>
        <div className="card p-4">
          <CreateUserForm />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Accounts
        </h2>
        <ul className="space-y-2">
          {everyone.map((person) => (
            <li key={person.id}>
              <UserRow person={{ ...person, createdAt: person.createdAt.toISOString() }} isSelf={person.id === me.id} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-ink-400">
        Being an admin lets you create and remove accounts. It does not let you read anyone
        else&apos;s training log - that still requires them to share it with you from their own
        settings.
      </p>
    </div>
  );
}
