import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listViewersOf } from "@/lib/access";
import { signOutAction } from "@/app/actions/auth";
import {
  revokeAccessAction,
  createInviteAction,
  revokeInviteAction,
  setUnitsAction,
} from "@/app/actions/sharing";
import { ShareForm } from "@/components/share-form";
import { InviteLink } from "@/components/invite-link";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const viewers = await listViewersOf(user.id);

  const myInvites =
    user.role === "admin"
      ? await db
          .select()
          .from(invites)
          .where(and(eq(invites.createdBy, user.id), isNull(invites.revokedAt)))
          .orderBy(desc(invites.createdAt))
          .limit(20)
      : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-400">
          {user.name} · {user.email}
          {user.role === "admin" && " · admin"}
        </p>
      </div>

      {user.role === "admin" && (
        <Link
          href="/admin"
          className="card flex items-center justify-between gap-3 p-4 transition hover:border-ink-600"
        >
          <span>
            <span className="block text-sm font-semibold text-ink-200">Manage people</span>
            <span className="mt-0.5 block text-xs text-ink-400">
              Create accounts, change roles, remove people
            </span>
          </span>
          <span className="shrink-0 text-ink-400">›</span>
        </Link>
      )}

      {/* ---------------------------------------------------- password */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Password
        </h2>
        <div className="card p-4">
          <ChangePasswordForm />
        </div>
      </section>

      {/* ------------------------------------------------------- units */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Units
        </h2>
        <form action={setUnitsAction} className="card flex items-center gap-3 p-4">
          <select name="units" defaultValue={user.units} className="field flex-1">
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
          <button type="submit" className="btn-ghost">
            Save
          </button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          Switching units only changes how numbers are displayed. Your logged history is not
          rewritten.
        </p>
      </section>

      {/* ------------------------------------------------------ sharing */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Who can see your log
        </h2>

        <div className="card p-4">
          <p className="text-sm leading-relaxed text-ink-400">
            Your training log is private. Give someone access below and they can view your
            workouts and records — nothing else changes, and they cannot edit anything.
            Sharing is one direction: this does not let you see theirs.
          </p>

          <div className="mt-4">
            <ShareForm />
          </div>

          {viewers.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-ink-800 pt-4">
              {viewers.map((viewer) => (
                <li key={viewer.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-200">{viewer.name}</p>
                    <p className="truncate text-xs text-ink-400">{viewer.email}</p>
                  </div>
                  <form action={revokeAccessAction}>
                    <input type="hidden" name="viewerId" value={viewer.id} />
                    <button
                      type="submit"
                      className="shrink-0 rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ invites */}
      {user.role === "admin" && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Invites
          </h2>

          <div className="card p-4">
            <p className="text-sm leading-relaxed text-ink-400">
              There is no public signup. Create a link, send it to someone, and they set up
              their own account. Links expire after 14 days.
            </p>

            <form action={createInviteAction} className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="label">
                  Who is it for
                </label>
                <input id="label" name="label" className="field" placeholder="Marcus" />
              </div>
              <div className="w-20">
                <label className="label" htmlFor="maxUses">
                  Uses
                </label>
                <input
                  id="maxUses"
                  name="maxUses"
                  inputMode="numeric"
                  defaultValue={1}
                  className="field text-center"
                />
              </div>
              <button type="submit" className="btn-primary">
                Create
              </button>
            </form>

            {myInvites.length > 0 && (
              <ul className="mt-4 space-y-3 border-t border-ink-800 pt-4">
                {myInvites.map((invite) => {
                  const spent = invite.usedCount >= invite.maxUses;
                  const expired = invite.expiresAt ? invite.expiresAt < new Date() : false;

                  return (
                    <li key={invite.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-ink-200">
                          {invite.label ?? "Unlabelled invite"}
                        </p>
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <button
                            type="submit"
                            className="shrink-0 rounded px-2 py-1 text-xs text-ink-400 hover:text-red-400"
                          >
                            Revoke
                          </button>
                        </form>
                      </div>

                      <p className="mt-0.5 text-xs text-ink-400">
                        {invite.usedCount}/{invite.maxUses} used
                        {spent && " · spent"}
                        {expired && " · expired"}
                      </p>

                      {!spent && !expired && <InviteLink code={invite.code} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <form action={signOutAction}>
        <button type="submit" className="btn-ghost w-full">
          Sign out
        </button>
      </form>
    </div>
  );
}
