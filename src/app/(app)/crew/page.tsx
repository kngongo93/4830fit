import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listVisibleTo } from "@/lib/access";

export default async function CrewPage() {
  const user = await requireUser();
  const crew = await listVisibleTo(user.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crew</h1>
        <p className="mt-1 text-sm text-ink-400">People who share their log with you.</p>
      </div>

      {crew.length === 0 ? (
        <div className="card p-5 text-sm leading-relaxed text-ink-400">
          Nobody is sharing with you yet. Sharing is per person and one direction — someone
          has to add you from their own settings before their log shows up here.
          <br />
          <br />
          To share yours, open{" "}
          <Link href="/settings" className="text-accent underline underline-offset-2">
            Settings
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-2">
          {crew.map((member) => (
            <li key={member.id}>
              <Link
                href={`/crew/${member.id}`}
                className="card flex items-center justify-between gap-3 px-4 py-4 transition hover:border-ink-600"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-200">{member.name}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Shared since{" "}
                    {member.grantedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-ink-400">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
