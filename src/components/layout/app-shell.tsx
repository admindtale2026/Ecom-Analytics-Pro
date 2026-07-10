"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "./sidebar";
import { FilterBar } from "./filter-bar";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function titleFor(pathname: string): string {
  const match = NAV_ITEMS.filter((i) => pathname.startsWith(i.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match?.label ?? "Dashboard";
}

export function AppShell({
  role,
  userName,
  people,
  children,
}: {
  role: "admin" | "sales";
  userName: string;
  people: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title = titleFor(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-[264px] shrink-0 lg:block">
        <SidebarContent role={role} userName={userName} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px]">
            <SidebarContent role={role} userName={userName} onNavigate={() => setOpen(false)} />
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 text-sidebar-muted hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">
                {title}
              </h1>
            </div>
            <div className="hidden md:block">
              <FilterBar people={people} />
            </div>
          </div>
          {/* Filters wrap below on small screens */}
          <div className="mt-3 md:hidden">
            <FilterBar people={people} />
          </div>
        </header>

        <main className={cn("flex-1 overflow-y-auto scroll-slim")}>
          <div id="page-content" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
