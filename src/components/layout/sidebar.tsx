"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import { doSignOut } from "@/lib/auth-actions";

export function SidebarContent({
  role,
  userName,
  onNavigate,
}: {
  role: "admin" | "sales";
  userName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === "admin");
  const main = items.filter((i) => i.group === "main");
  const system = items.filter((i) => i.group === "system");

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-brand-500 text-white shadow-[0_6px_16px_rgba(93,95,239,0.35)]"
            : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col bg-sidebar px-4 py-5">
      {/* Logo */}
      <Link href="/dashboard" onClick={onNavigate} className="mb-8 flex shrink-0 items-center gap-3 px-1.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-extrabold text-white">
          EA
        </span>
        <span className="text-xl font-extrabold tracking-tight text-white">EcomAnalytics</span>
      </Link>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto scroll-slim">
        <p className="px-3.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
          Main Menu
        </p>
        {main.map(renderItem)}

        {system.length > 0 && (
          <>
            <p className="px-3.5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
              System
            </p>
            {system.map(renderItem)}
          </>
        )}
      </nav>

      {/* User card + sign out */}
      <div className="mt-4 shrink-0 space-y-3">
        <Link
          href="/account"
          onClick={onNavigate}
          title="Account settings"
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-300">
            {initials(userName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
            <p className="text-[11px] uppercase tracking-wide text-sidebar-muted">{role}</p>
          </div>
          <Settings className="h-4 w-4 shrink-0 text-sidebar-muted" />
        </Link>
        <form action={doSignOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-semibold text-rose-400 transition-colors hover:text-rose-300"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
