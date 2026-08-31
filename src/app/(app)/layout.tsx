import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { TabBar } from "@/components/tab-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-800 bg-ink-950/90 px-4 py-3 backdrop-blur">
        <Link href="/today" className="text-lg font-bold tracking-tight">
          4830 <span className="text-accent">Fit</span>
        </Link>
        <Link
          href="/settings"
          className="rounded-lg px-2 py-1 text-sm text-ink-400 hover:text-ink-200"
        >
          {user.name.split(" ")[0]}
        </Link>
      </header>

      {/* Bottom padding clears the fixed tab bar. */}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <TabBar />
    </div>
  );
}
