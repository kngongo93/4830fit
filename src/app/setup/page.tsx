import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { noUsersYet } from "@/app/actions/admin";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

/**
 * First-run only. The moment an account exists this 404s, so it cannot be
 * used to mint a second admin on a live instance.
 */
export default async function SetupPage() {
  if (await getCurrentUser()) redirect("/today");
  if (!(await noUsersYet())) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink-200">
          4830 <span className="text-accent">Fit</span>
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          Nobody has an account yet. Create yours and you will be the admin.
        </p>
      </div>

      <SetupForm />

      <p className="mt-8 text-xs leading-relaxed text-ink-400">
        This page disappears as soon as your account exists. After that, new people are added
        from Settings.
      </p>
    </main>
  );
}
