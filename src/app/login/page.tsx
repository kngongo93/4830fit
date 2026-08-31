import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/today");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-ink-200">
          4830 <span className="text-accent">Fit</span>
        </h1>
        <p className="mt-2 text-sm text-ink-400">Progressive overload, tracked.</p>
      </div>

      <LoginForm />

      <p className="mt-8 text-xs leading-relaxed text-ink-400">
        4830 Fit is invite only. If you need an account, ask whoever runs your gym crew for a
        link.
      </p>
    </main>
  );
}
