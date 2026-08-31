import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (await getCurrentUser()) redirect("/today");

  const { code } = await params;

  const [invite] = await db
    .select({
      id: invites.id,
      label: invites.label,
      maxUses: invites.maxUses,
      usedCount: invites.usedCount,
      invitedBy: users.name,
    })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.createdBy))
    .where(
      and(
        eq(invites.code, code),
        isNull(invites.revokedAt),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, new Date())),
      ),
    )
    .limit(1);

  const valid = invite && invite.usedCount < invite.maxUses;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink-200">
          4830 <span className="text-accent">Fit</span>
        </h1>
        {valid ? (
          <p className="mt-2 text-sm text-ink-400">
            {invite.invitedBy} invited you. Set up your account below.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-400">Progressive overload, tracked.</p>
        )}
      </div>

      {valid ? (
        <JoinForm code={code} />
      ) : (
        <div className="card p-5">
          <p className="text-sm font-medium text-ink-200">This invite link is not usable.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">
            It may have already been used, been revoked, or expired. Ask for a fresh link.
          </p>
          <Link href="/login" className="btn-ghost mt-4 w-full">
            Back to sign in
          </Link>
        </div>
      )}

      {valid && (
        <p className="mt-8 text-xs leading-relaxed text-ink-400">
          Your training log is private by default. Nobody else sees it unless you choose to
          share it, and you can undo that at any time.
        </p>
      )}
    </main>
  );
}
