"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Database, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "delta" | "full";

const TOOLTIP: Record<Mode, string> = {
  delta: "Upserts modifications and new rows only. Faster, leaves deleted rows intact.",
  full: "Wipes the collection and writes everything from scratch. Slower, guarantees an exact match.",
};

/**
 * Delta / Full sync triggers. They POST to the very same `/api/sync` route the
 * Vercel cron calls, so a manual sync and a scheduled one cannot drift.
 */
export function SyncButtons({ store, showCommit }: { store: string; showCommit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(mode: Mode) {
    setBusy(mode);
    setMessage(null);
    try {
      const res = await fetch(`/api/sync?mode=${mode}&store=${store}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: body.hint ?? body.error ?? "Sync failed." });
      } else {
        const written = body.results?.[0]?.lines?.written ?? 0;
        setMessage({ ok: true, text: `Synced ${written} rows from Google Sheets.` });
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line bg-card p-0.5 shadow-sm">
          {(["delta", "full"] as Mode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => run(mode)}
              disabled={busy !== null}
              title={TOOLTIP[mode]}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
                "disabled:cursor-not-allowed disabled:opacity-60",
                mode === "delta" ? "text-brand-600 hover:bg-brand-50" : "text-ink hover:bg-slate-50",
              )}
            >
              {busy === mode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "delta" ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {mode === "delta" ? "Delta Sync" : "Full Sync"}
            </button>
          ))}
        </div>
        {/* Submits the Schema Mapping form by id, so it can only exist on that tab. */}
        {showCommit ? (
          <button
            form="schema-mapping-form"
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600"
          >
            <Save className="h-4 w-4" />
            Commit Changes
          </button>
        ) : null}
      </div>

      {message ? (
        <p
          role="status"
          className={cn(
            "max-w-md text-right text-xs font-medium",
            message.ok ? "text-pos" : "text-warn",
          )}
        >
          {message.text}
        </p>
      ) : null}
      {pending ? <span className="sr-only">Refreshing…</span> : null}
    </div>
  );
}
