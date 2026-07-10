import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian Rupees. Guards against NaN/null/undefined
 * (the reference app rendered "₹NaN" in a few places — we never do).
 */
export function formatCurrency(
  value: number | null | undefined,
  opts: { compact?: boolean; decimals?: number } = {},
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹0";
  if (opts.compact) {
    return "₹" + compactNumber(n);
  }
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: opts.decimals ?? 0,
      maximumFractionDigits: opts.decimals ?? 0,
    })
  );
}

/** Indian-style compact abbreviations (K / L / Cr). */
export function compactNumber(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2) + " Cr";
  if (abs >= 1_00_000) return (n / 1_00_000).toFixed(2) + " L";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

export function formatNumber(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN");
}

export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return n.toFixed(decimals) + "%";
}

/** Safe average that returns 0 instead of NaN when the denominator is 0. */
export function safeDivide(num: number, denom: number): number {
  if (!denom || !Number.isFinite(num / denom)) return 0;
  return num / denom;
}

/**
 * Collapse a ranked series to `n` slices plus an "Other" remainder.
 *
 * The chart palette is an 8-step ramp. Handing a donut 16 series makes the ramp
 * wrap, so slice 9 gets slice 1's colour and the legend stops being a key.
 * Callers that colour by identity must fold the tail first.
 */
export function topNWithOther<T extends { label: string; value: number }>(
  rows: T[],
  n = 7,
): { label: string; value: number }[] {
  if (rows.length <= n + 1) return rows;
  const head = rows.slice(0, n);
  const rest = rows.slice(n).reduce((s, r) => s + r.value, 0);
  return rest > 0 ? [...head, { label: "Other", value: rest }] : head;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
