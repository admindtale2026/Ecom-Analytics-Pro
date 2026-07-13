"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

// Versioned key: bumping it retires any pre-existing cookie (e.g. an old
// `range=all`) so the This-Month default in `resolveRange` takes effect once.
const COOKIE = "ea_filters_v2";
const KEYS = ["store", "sp", "range", "from", "to"] as const;
const ONE_YEAR = 60 * 60 * 24 * 365;

type FilterKey = (typeof KEYS)[number];

function readCookie(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const entry = document.cookie.split("; ").find((c) => c.startsWith(COOKIE + "="));
  if (!entry) return {};
  const p = new URLSearchParams(decodeURIComponent(entry.slice(COOKIE.length + 1)));
  return Object.fromEntries(p.entries());
}

/**
 * Apply a change to the global filters. They live in the `ea_filters_v2` cookie
 * (not the URL, so the address bar stays clean); writing it + `router.refresh()`
 * re-renders the server with the new filters. `null`/`""` clears a key.
 */
export function useApplyFilters() {
  const router = useRouter();
  return useCallback(
    (patch: Partial<Record<FilterKey, string | null>>) => {
      const next = readCookie();
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") delete next[k];
        else next[k] = v;
      }
      const p = new URLSearchParams();
      for (const k of KEYS) if (next[k]) p.set(k, next[k]);
      const value = p.toString();
      document.cookie = value
        ? `${COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`
        : `${COOKIE}=; path=/; max-age=0; samesite=lax`;
      router.refresh();
    },
    [router],
  );
}
