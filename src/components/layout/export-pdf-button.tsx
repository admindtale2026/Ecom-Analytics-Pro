"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

/**
 * Captures the #page-content region and saves it as a PDF, entirely
 * client-side (no headless browser). Libraries are imported lazily so they
 * never touch the server bundle.
 *
 * Uses `html2canvas-pro` (not the original html2canvas) because this app is on
 * Tailwind v4, whose default palette compiles to `oklch()` colors — the classic
 * html2canvas chokes on those and the export fails silently.
 */
export function ExportPdfButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleExport() {
    const node = document.getElementById("page-content");
    if (!node) return;
    setBusy(true);
    setError(false);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(node, {
        backgroundColor: "#f6f7f9",
        scale: 2,
        useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(img, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(img, "PNG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`ecomanalytics-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      // Surface the failure instead of silently spinning — a regression here
      // (e.g. an unsupported CSS color) would otherwise be invisible.
      console.error("Export PDF failed", err);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      title={error ? "Export failed — see console" : undefined}
      data-error={error || undefined}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60 data-[error=true]:border-rose-300 data-[error=true]:text-rose-600"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {error ? "Retry Export" : "Export PDF"}
    </button>
  );
}
