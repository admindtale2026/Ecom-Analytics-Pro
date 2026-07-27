"use client";

import { useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { loadProductPanel, loadProductMonthly, type WindowId } from "@/app/(app)/inventory/actions";
import { ProductDetailContent, type ProductPanelData } from "./product-detail-content";

/**
 * Product details render inline on /inventory as a slide-over — there is no
 * per-product URL. Data is fetched via server actions on open, keyed by
 * product name (the same key the rest of inventory.ts already groups by).
 */
export function ProductPanel({ name, onClose }: { name: string | null; onClose: () => void }) {
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [data, setData] = useState<ProductPanelData | null>(null);
  const [win, setWin] = useState<WindowId>("last6");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [monthlyPending, startMonthlyTransition] = useTransition();

  // Reset local state for the newly-opened product during render rather than
  // in an effect (https://react.dev/learn/you-might-not-need-an-effect) — this
  // also means closing (name -> null) keeps the last content visible while
  // the panel slides out instead of blanking it.
  if (name !== null && name !== loadedFor) {
    setLoadedFor(name);
    setData(null);
    setNotFound(false);
    setWin("last6");
    setLoading(true);
  }

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    loadProductPanel(name, "last6").then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res) {
        setNotFound(true);
        return;
      }
      setData(res);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  function handleWindowChange(w: WindowId) {
    if (!name) return;
    setWin(w);
    startMonthlyTransition(async () => {
      const monthly = await loadProductMonthly(name, w);
      setData((d) => (d ? { ...d, monthly } : d));
    });
  }

  const open = !!name;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-[fade_var(--dur-base)_var(--ease-out)]" />
        <Dialog.Content
          className="panel-slide fixed inset-y-0 right-0 z-[61] flex w-full max-w-xl flex-col border-l border-line bg-canvas shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line bg-card px-6 py-4">
            <Dialog.Title className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Product Details
            </Dialog.Title>
            <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-slate-100 hover:text-ink">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto scroll-slim p-6">
            {loading && (
              <div className="flex h-64 items-center justify-center text-ink-soft">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {notFound && (
              <div className="flex h-64 items-center justify-center text-sm text-ink-soft">
                No data for this product in the current filters.
              </div>
            )}
            {data && (
              <ProductDetailContent
                data={data}
                window={win}
                onWindowChange={handleWindowChange}
                monthlyPending={monthlyPending}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
