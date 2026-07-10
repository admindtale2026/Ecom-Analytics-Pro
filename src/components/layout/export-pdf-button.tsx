"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

/**
 * Captures the #page-content region and saves it as a PDF, entirely
 * client-side (no headless browser). Libraries are imported lazily so they
 * never touch the server bundle.
 */
export function ExportPdfButton() {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    const node = document.getElementById("page-content");
    if (!node) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Export PDF
    </button>
  );
}
