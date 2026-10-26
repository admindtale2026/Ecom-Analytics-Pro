import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Table2,
  BarChart3,
  Users,
  HeartHandshake,
  Package,
  PackageX,
  MapPin,
  UserCog,
  Settings,
  Map,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: "main" | "system";
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "main" },
  { label: "Orders Data", href: "/orders", icon: Table2, group: "main" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, group: "main" },
  { label: "Sales Team", href: "/sales-team", icon: Users, group: "main" },
  { label: "Customers", href: "/customers", icon: HeartHandshake, group: "main" },
  { label: "Inventory", href: "/inventory", icon: Package, group: "main" },
  { label: "Not Processed", href: "/not-processed", icon: PackageX, group: "main" },
  { label: "Regions", href: "/regions", icon: MapPin, group: "main" },
  { label: "Ad Opportunity", href: "/opportunity", icon: Map, group: "main" },
  { label: "Manage Users", href: "/admin/users", icon: UserCog, group: "system", adminOnly: true },
  { label: "Admin Settings", href: "/admin/settings", icon: Settings, group: "system", adminOnly: true },
];

/**
 * Store tenants (from the "Select Store" dropdown in the reference app).
 * `color` gives each store its own accent chip in the switcher — used as an
 * inline style so Tailwind's static scan isn't required.
 */
export const STORES = [
  { id: "modern", name: "Modern", color: "#5d5fef" },
  { id: "homes", name: "Homes", color: "#0ea5e9" },
  { id: "decor", name: "Decor", color: "#f59e0b" },
] as const;
export type StoreId = (typeof STORES)[number]["id"];

/** Order fulfilment statuses used in filters/badges. */
export const ORDER_STATUSES = [
  "Processing",
  "Dispatched",
  "Delivered",
  "Cancelled",
  "Returned",
  "Not Processed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "custom", label: "Custom Range" },
] as const;
export type DatePresetId = (typeof DATE_PRESETS)[number]["id"];

/**
 * Chart palette: one indigo ramp (dark→light) closed out by two neutrals.
 * Series are always sorted by magnitude before colouring, so the ramp encodes
 * rank instead of identity — which keeps a ten-slice donut legible without ten
 * competing hues. Legends/labels always accompany colour; hue is never the only
 * channel. A 9th series folds into "Other".
 */
export const CHART_COLORS = [
  "#3730a3",
  "#4f46e5",
  "#6366f1",
  "#818cf8",
  "#a5b4fc",
  "#c7d2fe",
  "#94a3b8",
  "#cbd5e1",
];

export const BRAND = "#5d5fef";

/** Single-hue fills for magnitude bars (not identity). */
export const BAR_FILL = "#6366f1";
export const BAR_FILL_MUTED = "#c7d2fe";
