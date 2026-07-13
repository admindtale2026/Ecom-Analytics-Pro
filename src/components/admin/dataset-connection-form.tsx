"use client";

import { useActionState, useState } from "react";
import { FileSpreadsheet, HardDriveUpload, Link2, CheckCircle2, AlertTriangle } from "lucide-react";
import { setDataSource, type ActionState } from "@/lib/admin-actions";
import { UploadForm } from "./upload-form";
import type { StoreId } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Dataset connection form (source kind + sheet URL).
 *
 * Split out of the server `AdminPanel` so the source selection is reactive: only
 * the section relevant to the chosen source is shown (the sheet URL for Google
 * Sheets, the file dropzone for Native Upload). The submit button lives in the
 * page header next to the sync buttons and targets this form by its id.
 */
export function DatasetConnectionForm({
  storeId,
  kind: initialKind,
  endpointUrl,
  lastSyncedLabel,
}: {
  storeId: StoreId;
  kind: "sheets" | "upload";
  endpointUrl: string;
  lastSyncedLabel: string | null;
}) {
  const [state, action] = useActionState<ActionState | undefined, FormData>(setDataSource, undefined);
  const [kind, setKind] = useState<"sheets" | "upload">(initialKind);

  return (
    <div className="space-y-6">
      <form id="dataset-connection-form" action={action} className="space-y-6">
        <input type="hidden" name="store" value={storeId} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-5 transition-colors duration-150",
              kind === "sheets" ? "border-brand-400 bg-brand-50/40" : "border-line hover:border-brand-200",
            )}
          >
            <input
              type="radio"
              name="kind"
              value="sheets"
              checked={kind === "sheets"}
              onChange={() => setKind("sheets")}
              className="sr-only"
            />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold text-ink">Google Sheets Integration</span>
              <span className="block text-sm text-ink-soft">
                Scheduled cloud polling — delta hourly, full sync nightly.
              </span>
            </span>
          </label>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-5 transition-colors duration-150",
              kind === "upload" ? "border-brand-400 bg-brand-50/40" : "border-line hover:border-brand-200",
            )}
          >
            <input
              type="radio"
              name="kind"
              value="upload"
              checked={kind === "upload"}
              onChange={() => setKind("upload")}
              className="sr-only"
            />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-ink-soft">
              <HardDriveUpload className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold text-ink">Native Upload</span>
              <span className="block text-sm text-ink-soft">
                Import an .xlsx / .csv workbook directly. No credentials required.
              </span>
            </span>
          </label>
        </div>

        {kind === "sheets" ? (
          <div className="space-y-1.5">
            <label
              htmlFor="endpointUrl"
              className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft"
            >
              Live endpoint URL
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-50/60 px-3.5 py-3">
              <Link2 className="h-4 w-4 shrink-0 text-ink-soft" />
              <input
                id="endpointUrl"
                name="endpointUrl"
                defaultValue={endpointUrl}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </div>
            {lastSyncedLabel ? <p className="text-xs text-ink-soft">{lastSyncedLabel}</p> : null}
          </div>
        ) : null}

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
      </form>

      {/* Outside the form: UploadForm posts to /api/upload on its own and must
          not nest inside another form. Shown only for the Native Upload source. */}
      {kind === "upload" ? (
        <div className="border-t border-line pt-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            Native upload
          </p>
          <UploadForm store={storeId} />
        </div>
      ) : null}
    </div>
  );
}
