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
    const body = new FormData();
    body.set("file", file);
    body.set("store", store);
    try {
      const res = await fetch("/api/catalog", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: json.error ?? "Upload failed." });
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
