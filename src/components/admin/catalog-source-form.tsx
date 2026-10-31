"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { setCatalogSource, type ActionState } from "@/lib/admin-actions";
import { cn } from "@/lib/utils";

/**
 * Catalog source = a link-shared Google Sheet holding the full Magento product
 * export. Saving stores the link (server action); "Sync Catalog" pulls it now via
 * /api/catalog/sync — the same route the nightly cron hits — and reloads the
 * store's catalog, re-deriving each product's launch-month tag.
 */
export function CatalogSourceForm({
  store,
  sheetUrl,
  lastSyncedLabel,
}: {
  store: string;
  sheetUrl: string;
  lastSyncedLabel: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState | undefined, FormData>(
    setCatalogSource,
    undefined,
  );
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<{ ok: boolean; text: string } | null>(null);

  async function runSync() {
    setBusy(true);
    setSync(null);
    try {
      const res = await fetch(`/api/catalog/sync?store=${store}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.results?.length) {
        const first = body?.failures?.[0]?.error;
        setSync({ ok: false, text: first ?? body?.error ?? `Sync failed (HTTP ${res.status}).` });
      } else {
        const p = body.results[0].products;
        setSync({
          ok: true,
          text: `Synced ${p.written} products — ${p.withMonth} tagged with a launch month.`,
        });
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setSync({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="store" value={store} />
        <label
          htmlFor="catalog-sheet-url"
          className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft"
        >
          Catalog Google Sheet link
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-50/60 px-3.5 py-3">
          <Link2 className="h-4 w-4 shrink-0 text-ink-soft" />
          <input
            id="catalog-sheet-url"
            name="sheetUrl"
            defaultValue={sheetUrl}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="w-full bg-transparent text-sm text-ink outline-none"
          />
        </div>
        <p className="text-xs text-ink-soft">
          Share the sheet as <strong className="font-semibold text-ink">anyone with the link can
          view</strong>. It must be the full Magento product export; the launch month is read from
          each row&rsquo;s <em className="font-medium text-ink">Categories</em> cell (e.g. &ldquo;Jan
          26&rdquo;).
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
            Save link
          </button>
          <button
            type="button"
            onClick={runSync}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Catalog
          </button>
          {lastSyncedLabel ? <span className="text-xs text-ink-soft">{lastSyncedLabel}</span> : null}
        </div>
      </form>

      {state?.error ? (
        <p role="alert" className="flex items-center gap-2 text-xs font-medium text-neg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="flex items-center gap-2 text-xs font-medium text-pos">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.ok}
        </p>
      ) : null}
      {sync ? (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 text-xs font-medium",
            sync.ok ? "text-pos" : "text-neg",
          )}
        >
          {sync.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {sync.text}
        </p>
      ) : null}
    </div>
  );
}
