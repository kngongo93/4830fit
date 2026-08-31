"use client";

import { useEffect, useState } from "react";

export function InviteLink({ code }: { code: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Built on the client so the link matches whatever host you actually
  // opened the app on - localhost in dev, the real domain in production.
  useEffect(() => {
    setUrl(`${window.location.origin}/join/${code}`);
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside HTTPS; the text stays selectable.
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs text-ink-400">
        {url || `/join/${code}`}
      </code>
      <button type="button" onClick={copy} className="btn-ghost shrink-0 px-3 py-2 text-xs">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
