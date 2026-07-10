/**
 * Ad-spend quadrant vocabulary. Lives in lib/ (not server/) so client charts can
 * import the labels without pulling the database client into the browser bundle.
 */
export type Quadrant = "scale" | "defend" | "nurture" | "hold";

export type OpportunityCity = {
  city: string;
  state: string;
  orders: number;
  revenue: number;
  aov: number;
  quadrant: Quadrant;
};

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  scale: "Scale spend",
  defend: "Defend",
  nurture: "Nurture",
  hold: "Hold",
};

export const QUADRANT_BLURBS: Record<Quadrant, string> = {
  scale: "High basket value, low order count — the clearest headroom for ad spend.",
  defend: "High value and high volume. Already working; protect the position.",
  nurture: "Low value, low volume. Test small before committing budget.",
  hold: "High volume but thin baskets. Grow basket size before buying more traffic.",
};

export const QUADRANT_COLORS: Record<Quadrant, string> = {
  scale: "#10b981",
  defend: "#6366f1",
  hold: "#f59e0b",
  nurture: "#94a3b8",
};

/**
 * Rupees/period a city would add if its order count merely reached the median,
 * at the basket size it already demonstrates.
 *
 * This deliberately does *not* reward cities that are already above median
 * volume: their upside is a different play (raise basket size), not more ad
 * spend. A city with a big basket and few orders scores highest, which is what
 * "under-served demand" looks like.
 */
export function adHeadroom(city: OpportunityCity, medianOrders: number): number {
  return city.aov * Math.max(0, medianOrders - city.orders);
}

/**
 * Where to put the next rupee of ad budget. Restricted to the "scale" quadrant
 * (proven basket value, thin volume) and ranked by headroom. A city with just
 * one order is excluded: a single sale is an anecdote, not a demand signal.
 */
export function recommendCities(
  cities: OpportunityCity[],
  medianOrders: number,
  limit = 3,
): (OpportunityCity & { headroom: number })[] {
  return cities
    .filter((c) => c.quadrant === "scale" && c.orders > 1)
    .map((c) => ({ ...c, headroom: adHeadroom(c, medianOrders) }))
    .sort((a, b) => b.headroom - a.headroom)
    .slice(0, limit);
}
