"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Store, ChevronDown, User, Check, Calendar } from "lucide-react";
import { STORES, DATE_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ExportPdfButton } from "./export-pdf-button";

function usePatchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, sp],
  );
}

const triggerCls =
  "inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50";

export function StoreSelector() {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const current = STORES.find((s) => s.id === (sp.get("store") ?? "modern")) ?? STORES[0];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerCls}>
        <Store className="h-4 w-4 text-ink-soft" />
        <span className="uppercase">{current.name}</span>
        <ChevronDown className="h-4 w-4 text-ink-soft" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-44 rounded-xl border border-line bg-card p-1.5 shadow-lg"
        >
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Select Store
          </p>
          {STORES.map((s) => (
            <DropdownMenu.Item
              key={s.id}
              onSelect={() => patch({ store: s.id })}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm outline-none",
                s.id === current.id ? "font-semibold text-brand-600" : "text-ink hover:bg-slate-50",
              )}
            >
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                {s.name}
              </span>
              {s.id === current.id && <Check className="h-4 w-4" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function SalespersonFilter({ people }: { people: string[] }) {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const selected = (sp.get("sp")?.split(",").filter(Boolean)) ?? [];
  const [open, setOpen] = useState(false);

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((s) => s !== name)
      : [...selected, name];
    patch({ sp: next.length ? next.join(",") : null });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={triggerCls}>
        <User className="h-4 w-4 text-ink-soft" />
        <span>{selected.length ? `${selected.length} selected` : "Sales Team"}</span>
        <ChevronDown className="h-4 w-4 text-ink-soft" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-60 rounded-xl border border-line bg-card p-1.5 shadow-lg"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <button
              onClick={() => patch({ sp: people.join(",") })}
              className="text-xs font-semibold text-ink"
            >
              Select All
            </button>
            <button
              onClick={() => patch({ sp: null })}
              className="text-xs font-semibold text-brand-600"
            >
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

export function DateRangeFilter() {
  const sp = useSearchParams();
  const patch = usePatchParams();
  const current = sp.get("range") ?? "all";
  return (
    <Popover.Root>
      <Popover.Trigger className={triggerCls}>
        <Calendar className="h-4 w-4 text-ink-soft" />
        <span>{DATE_PRESETS.find((p) => p.id === current)?.label ?? "All Time"}</span>
        <ChevronDown className="h-4 w-4 text-ink-soft" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-52 rounded-xl border border-line bg-card p-1.5 shadow-lg"
        >
          <button
            onClick={() => patch({ range: null, from: null, to: null })}
            className={cn(
              "flex w-full items-center rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50",
              current === "all" ? "font-semibold text-brand-600" : "text-ink",
            )}
          >
            All Time
          </button>
          {DATE_PRESETS.filter((p) => p.id !== "custom").map((p) => (
            <button
              key={p.id}
              onClick={() => patch({ range: p.id, from: null, to: null })}
              className={cn(
                "flex w-full items-center rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50",
                current === p.id ? "font-semibold text-brand-600" : "text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="mt-1 space-y-1.5 border-t border-line px-2.5 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              Custom Range
            </p>
            <input
              type="date"
              defaultValue={sp.get("from") ?? ""}
              onChange={(e) => patch({ range: "custom", from: e.target.value })}
              className="w-full rounded-lg border border-line px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              defaultValue={sp.get("to") ?? ""}
              onChange={(e) => patch({ range: "custom", to: e.target.value })}
              className="w-full rounded-lg border border-line px-2 py-1.5 text-sm"
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FilterBar({ people }: { people: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StoreSelector />
      <SalespersonFilter people={people} />
      <DateRangeFilter />
      <ExportPdfButton />
    </div>
  );
}
