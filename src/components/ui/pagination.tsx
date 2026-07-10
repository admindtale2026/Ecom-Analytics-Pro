"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePatchParams } from "@/hooks/use-patch-params";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const patch = usePatchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const go = (p: number) => patch({ page: String(Math.min(pages, Math.max(1, p))) });

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <p className="text-sm text-ink-soft tnum">
        Showing <span className="font-semibold text-ink">{from}</span>–
        <span className="font-semibold text-ink">{to}</span> of{" "}
        <span className="font-semibold text-ink">{total.toLocaleString("en-IN")}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 text-sm font-medium text-ink tnum">
          {page} / {pages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= pages}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card disabled:opacity-40",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
