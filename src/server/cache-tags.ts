/**
 * Cache tag for a store's derived data (KPIs, aggregations, latest-order-date).
 * Query results are cached with this tag and invalidated by a sync/upload, so
 * fresh numbers appear immediately after data changes while everything else is
 * served from cache with no database round-trip.
 */
export function dataTag(storeId: string): string {
  return `data:${storeId}`;
}
