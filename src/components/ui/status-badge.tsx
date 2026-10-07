import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  Delivered: "bg-emerald-50 text-emerald-700",
  Dispatched: "bg-blue-50 text-blue-700",
  Processing: "bg-amber-50 text-amber-700",
  Cancelled: "bg-rose-50 text-rose-700",
  Returned: "bg-slate-100 text-slate-600",
  "Not Processed": "bg-orange-50 text-orange-700",
};

export function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "—";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLES[s] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {s}
    </span>
  );
}

/** Fulfilment classes (product_category), each with its own accent. */
const FULFILMENT_STYLES: Record<string, string> = {
  "Ready To Ship": "bg-emerald-50 text-emerald-700",
  "Made To Order": "bg-indigo-50 text-indigo-700",
  "Warehouse Sale": "bg-amber-50 text-amber-700",
};

/** Small pill marking how a product ships. Renders nothing when untagged. */
export function FulfilmentBadge({ value }: { value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        FULFILMENT_STYLES[value] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {value}
    </span>
  );
}
