"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Result =
  | { ok: true; written: number; withoutDate: number }
  | { ok: false; error: string };

/** Catalog upload: posts a Magento product export to /api/catalog. */
export function CatalogUploadForm({ store }: { store: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [, startTransition] = useTransition();

  async function send(file: File) {
    setBusy(true);
    setResult(null);
    try {
      // Parse + slim in the browser. A raw Magento export is ~90 columns and
      // can be 15MB+; the serverless platform rejects a body that large at the
      // edge (a plain-text 413) before the route runs. We keep only the columns
      // the ingest reads and POST compact JSON, which stays well under the
      // limit. xlsx is heavy, so it is only loaded once a file is chosen.
      const [{ parseWorkbook }, { projectCatalogRow }] = await Promise.all([
        import("@/lib/ingest/workbook"),
        import("@/lib/ingest/catalog-columns"),
      ]);
      const rows = parseWorkbook(await file.arrayBuffer()).lines.map(projectCatalogRow);
      if (!rows.length) {
        setResult({ ok: false, error: "That file has no product rows." });
        return;
      }

      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ store, rows }),
      });

      // Read as text first: a platform-level error (413, gateway timeout) comes
      // back as plain text, not JSON, and blindly calling res.json() on it is
      // what produced the cryptic "Unexpected token 'R'…" error.
      const text = await res.text();
      let json: { error?: string; products?: { written: number; withoutDate: number } } | null = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.products) {
        setResult({
          ok: false,
          error:
            json?.error ??
            (res.status === 413
              ? "That file is too large for the server to accept. Try re-exporting a smaller catalog."
              : `Upload failed (HTTP ${res.status}).`),
        });
      } else {
        setResult({
          ok: true,
          written: json.products.written,
          withoutDate: json.products.withoutDate,
        });
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void send(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center",
          "transition-colors duration-150",
          dragging ? "border-brand-400 bg-brand-50" : "border-line bg-slate-50/60 hover:border-brand-300",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void send(file);
            e.target.value = "";
          }}
        />
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </span>
        <span className="text-sm font-semibold text-ink">
          {busy ? "Importing catalog…" : "Drop the Magento product export (.csv) here, or click to choose"}
        </span>
        <span className="text-xs text-ink-soft">
          Each upload replaces this store&rsquo;s catalog — products no longer exported are removed.
        </span>
      </label>

      {result ? (
        result.ok ? (
          <p role="status" className="flex items-center gap-2 text-xs font-medium text-pos">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Imported {result.written} products
            {result.withoutDate ? `; ${result.withoutDate} had no creation date` : ""}.
          </p>
        ) : (
          <p role="alert" className="flex items-center gap-2 text-xs font-medium text-neg">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {result.error}
          </p>
        )
      ) : null}
    </div>
  );
}
