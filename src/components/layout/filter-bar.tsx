"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, User, Check, Calendar, ArrowRight } from "lucide-react";
import { STORES, DATE_PRESETS } from "@/lib/constants";
import type { Filters } from "@/lib/filters";
import { useApplyFilters } from "@/hooks/use-apply-filters";
import { cn } from "@/lib/utils";
import { ExportPdfButton } from "./export-pdf-button";

/** A patch of raw filter values. `null` clears a key. */
type FilterPatch = Partial<Record<"store" | "sp" | "range" | "from" | "to", string | null>>;

const triggerCls =
  "inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold text-ink shadow-sm transition-colors duration-150 hover:bg-slate-50";

// Shared menu surface. `overlay-pop` scales the *inner* content in (positioning
// lives on the Radix wrapper, which must not be transformed — see globals.css).
const menuCls = "overlay-pop z-50 rounded-xl border border-line bg-card p-1.5 shadow-lg";

function StoreSelector({
  current,
  apply,
  allowedStores,
}: {
  current: string;
  apply: (p: FilterPatch) => void;
  allowedStores: string[];
}) {
  // Only the stores this user may access. Belt-and-suspenders: the server also
  // clamps an out-of-scope store in `getFilters`, so this is UX, not the gate.
  const stores = STORES.filter((s) => allowedStores.includes(s.id));
  const store = stores.find((s) => s.id === current) ?? stores[0] ?? STORES[0];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerCls}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: store.color }} />
        <span className="uppercase">{store.name}</span>
        <ChevronDown className="h-4 w-4 text-ink-soft" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={cn(menuCls, "min-w-48")}>
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Select Store
          </p>
          {stores.map((s) => {
            const active = s.id === store.id;
            return (
              <DropdownMenu.Item
                key={s.id}
                onSelect={() => apply({ store: s.id })}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-150",
                  active ? "bg-slate-50 font-semibold text-ink" : "text-ink hover:bg-slate-50",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.name[0]}
                  </span>
                  {s.name}
                </span>
                {active && <Check className="h-4 w-4 text-brand-600" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SalespersonFilter({
  people,
  selected,
  apply,
}: {
  people: string[];
  selected: string[];
  apply: (p: FilterPatch) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((s) => s !== name)
      : [...selected, name];
    apply({ sp: next.length ? next.join(",") : null });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={triggerCls}>
        <User className="h-4 w-4 text-ink-soft" />
        <span>{selected.length ? `${selected.length} selected` : "Sales Team"}</span>
        <ChevronDown className="h-4 w-4 text-ink-soft" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className={cn(menuCls, "w-60")}>
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <button onClick={() => apply({ sp: people.join(",") })} className="text-xs font-semibold text-ink">
              Select All
            </button>
            <button onClick={() => apply({ sp: null })} className="text-xs font-semibold text-brand-600">
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto scroll-slim">
            {people.map((name) => {
              const on = selected.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      on ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300",
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The reference "Select Date Range" dialog: two native date pickers + Apply. */
function DateRangeModal({
  open,
  onOpenChange,
  initialFrom,
  initialTo,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialFrom: string;
  initialTo: string;
  onApply: (from: string, to: string) => void;
}) {
  const inputCls =
    "w-full rounded-xl border border-line bg-slate-50/60 px-3.5 py-3 text-base font-bold text-ink outline-none transition-colors duration-150 focus:border-brand-400 focus:bg-card";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-[fade_var(--dur-base)_var(--ease-out)]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-card p-7 shadow-2xl focus:outline-none data-[state=open]:animate-[fade_var(--dur-base)_var(--ease-out)]"
        >
          {/* Scale-in lives on an inner wrapper — the Content itself is centered
              with a translate transform we must not animate over. */}
          <div className="animate-[pop-scale_var(--dur-base)_var(--ease-out)]">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Calendar className="h-6 w-6" />
            </span>
            <Dialog.Title className="mt-4 text-xl font-extrabold tracking-tight text-ink">
              Select Date Range
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-ink-soft">
              Filter across all performance metrics
            </Dialog.Description>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onApply(String(fd.get("from") ?? ""), String(fd.get("to") ?? ""));
            }}
            className="mt-6 space-y-4"
          >
            <div className="space-y-1.5">
              <label htmlFor="dr-from" className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Start Date
              </label>
              <input id="dr-from" name="from" type="date" defaultValue={initialFrom} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dr-to" className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                End Date
              </label>
              <input id="dr-to" name="to" type="date" defaultValue={initialTo} className={inputCls} />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold uppercase tracking-wide text-ink-soft transition-colors duration-150 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors duration-150 hover:bg-brand-600"
              >
                Apply
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DateRangeFilter({
  presetId,
  rangeLabel,
  customFrom,
  customTo,
  apply,
}: {
  presetId: string;
  rangeLabel: string;
  customFrom: string;
  customTo: string;
  apply: (p: FilterPatch) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const current = presetId;
  // Show the server-resolved label (covers the "latest month" smart-default and
  // custom ranges); fall back to the preset's own label for the known presets.
  const label =
    rangeLabel ||
    (current === "all" ? "All Time" : (DATE_PRESETS.find((p) => p.id === current)?.label ?? "All Time"));

  const itemCls = (active: boolean) =>
    cn(
      "flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-150 hover:bg-slate-50",
      active ? "font-semibold text-brand-600" : "text-ink",
    );

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={triggerCls}>
          <Calendar className="h-4 w-4 text-ink-soft" />
          <span>{label}</span>
          <ChevronDown className="h-4 w-4 text-ink-soft" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className={cn(menuCls, "w-52")}>
            <DropdownMenu.Item
              onSelect={() => apply({ range: "all", from: null, to: null })}
              className={itemCls(current === "all")}
            >
              All Time
            </DropdownMenu.Item>
            {DATE_PRESETS.filter((p) => p.id !== "custom").map((p) => (
              <DropdownMenu.Item
                key={p.id}
                onSelect={() => apply({ range: p.id, from: null, to: null })}
                className={itemCls(current === p.id)}
              >
                {p.label}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={() => requestAnimationFrame(() => setModalOpen(true))}
              className={cn(itemCls(current === "custom"), "justify-between")}
            >
              Custom Range…
              <Calendar className="h-3.5 w-3.5 text-ink-soft" />
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DateRangeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialFrom={customFrom}
        initialTo={customTo}
        onApply={(from, to) => {
          apply({ range: "custom", from: from || null, to: to || null });
          setModalOpen(false);
        }}
      />
    </>
  );
}

export function FilterBar({
  people,
  filters,
  allowedStores,
}: {
  people: string[];
  filters: Filters;
  allowedStores: string[];
}) {
  const apply = useApplyFilters();

  const customFrom = filters.presetId === "custom" && filters.from ? filters.from.toISOString().slice(0, 10) : "";
  const customTo = filters.presetId === "custom" && filters.to ? filters.to.toISOString().slice(0, 10) : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StoreSelector current={filters.storeId} apply={apply} allowedStores={allowedStores} />
      <SalespersonFilter people={people} selected={filters.salespeople} apply={apply} />
      <DateRangeFilter
        presetId={filters.presetId}
        rangeLabel={filters.rangeLabel}
        customFrom={customFrom}
        customTo={customTo}
        apply={apply}
      />
      <ExportPdfButton />
    </div>
  );
}
