"use server";

import { getFilters } from "@/lib/filters-server";
import {
  getProductDetail,
  getProductTrend,
  getProductCities,
  getProductStates,
  getProductReps,
  getProductMonthly,
} from "@/server/inventory";

export type WindowId = "last6" | "thisYear" | "lastYear";

export async function loadProductPanel(name: string, window: WindowId = "last6") {
  const f = await getFilters();
  const detail = await getProductDetail(f, name);
  if (!detail) return null;

  const [trend, cities, states, reps, monthly] = await Promise.all([
    getProductTrend(f, name),
    getProductCities(f, name),
    getProductStates(f, name),
    getProductReps(f, name),
    getProductMonthly(f, name, window),
  ]);

  return { detail, trend, cities, states, reps, monthly, window };
}

export async function loadProductMonthly(name: string, window: WindowId) {
  const f = await getFilters();
  return getProductMonthly(f, name, window);
}
