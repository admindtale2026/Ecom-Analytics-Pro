# CHECKLIST

Tick an item **only after** the module's verification gate passes:
`npx tsc --noEmit && npx eslint && npm run build`, plus driving the real page in a browser at
1440×900 and 390×844 and comparing against the reference image in `screenshots/`.

See `PROGRESS.md` for where work stopped. See `plan.md` for the architecture.

---

## M0 — Foundation

- [x] `plan.md` at repo root
- [x] `PROGRESS.md` + `CHECKLIST.md`
- [x] Motion tokens retuned (120/180/280ms, hard ceiling 500ms)
- [x] `html { font-size: 14px }` (down from 15px)
- [x] `src/lib/ingest/normalize.ts` — `titleCase`, `normalizeCity`, `normalizeState`, `normalizeLabel`, alias maps as data
- [x] `schema.ts`: `row_hash` column + `uniqueIndex(store_id, row_hash)`
- [x] `schema.ts`: composite indexes `(store_id, order_date)`, `(store_id, ship_state)`, `(store_id, sales_person)`
- [x] `npm run db:generate && npm run db:migrate` → `drizzle/0001_busy_maverick.sql`
- [x] Cleared pre-existing lint debt (unused import, misplaced eslint-disable, `any` in seed)
- [x] Gate passes (tsc clean, eslint clean, build green — 16 routes)

## M1 — Ingest (xlsx/csv upload)

- [x] `xlsx` parse (`src/lib/ingest/workbook.ts`) → `mapRow()` → `normalizeLine()` → upsert, all in `src/lib/ingest/pipeline.ts`
- [x] `rowHash` computed from immutable descriptors only
- [x] Idempotent upsert: on conflict update quantity / paymentAmount / status / dates via `excluded`
- [x] In-batch dedupe (Postgres refuses to update the same row twice in one `ON CONFLICT`)
- [x] `POST /api/upload` route handler (admin-guarded, 25MB cap, `runtime = "nodejs"`)
- [x] `resolveMapping()` in `src/server/admin.ts` layers admin overrides over `defaultMapping()`
- [x] `ingestOrderSummary()` (replace-wholesale) + `dropStaleBatches()` for full sync
- [x] Ingested a synthetic sheet reproducing every reference defect; **zero `NaN` reached the DB**
- [x] Re-ingest of the same sheet → row count unchanged (6 → 6)
- [x] Gate passes (tsc, eslint, build)

> **Deviation from `plan.md`:** no `rollupCustomers()`. `getCustomers()` in `src/server/customers.ts`
> already derives buyers live from `order_lines`, so materialising a `customers` table would create a
> second source of truth that can drift. `safeDivide` alone fixes bug #1. The `customers` table stays
> seed-only for now.

## M2 — Google Sheets sync + cron

- [x] `src/lib/ingest/sheets.ts` — service-account JWT, `batchGet` of all tabs, returns the same `Workbook` shape as the file parser so the pipeline can't tell them apart
- [x] `extractSpreadsheetId()` accepts a full edit URL or a bare id
- [x] `GET`/`POST /api/sync?mode=delta|full&store=`, `maxDuration = 300`
- [x] Auth: `Bearer $CRON_SECRET` (cron) **or** signed-in admin (buttons)
- [x] Missing `GOOGLE_SERVICE_ACCOUNT_JSON` → **verified 503** with an actionable hint, never a crash
- [x] Full sync = new `syncBatchId` then `dropStaleBatches()` (verified in M1 test)
- [x] Cron with no `store` param syncs every store; one bad store doesn't abort the rest
- [x] `vercel.json` — delta `0 * * * *`; full `30 21 * * *` (**UTC** = 03:00 IST)
- [x] Verified: `/api/upload` returns 400 on missing file and on unknown store
- [x] Gate passes

> **Security fix made here.** `getCurrentUser()` fell back to a hardcoded **demo admin** whenever
> Auth.js wasn't configured. Since `/api/upload` and `/api/sync` gate on `role === "admin"`, that
> left both mutation endpoints open to anyone in a deployed build. `src/lib/session.ts` now returns
> an anonymous, no-access user when `NODE_ENV === "production"`; the demo admin is dev-only.

- [ ] **Deferred until credentials exist:** end-to-end delta-sync-twice against a real sheet
      (the underlying upsert idempotency *is* covered by the M1 test)

## M3 — Pages (7 stubs → real)

- [x] `sales-team` + `[name]` detail (rep page = dashboard with `salespeople` pinned; no parallel queries)
- [x] `customers`
- [x] `inventory` + `[product]` detail (month-window tabs)
- [x] `not-processed` + `[orderId]` detail
- [x] `regions` + `[state]` detail + `city/[city]` detail
- [x] Admin panel: one `AdminPanel`, 4 tabs, serving both `/admin/users` (opens on Team Access) and `/admin/settings` (opens on Dataset Connection)
- [x] `saveSchemaMapping` action (stores only genuine overrides, not defaults)
- [x] `/opportunity` built (scatter + recommendations; **map lands in M4**)
- [x] Deleted `src/components/ui/stub.tsx`
- [x] All 11 top-level routes + 15 sampled detail routes return 200
- [x] Gate passes (tsc, eslint, build — 22 routes)

### Reference bugs fixed (each verified against the rendered page)

- [x] #1 no `₹NaN` on Customers — Avg Lifetime Value reads ₹7,16,194; Gross Spend real
- [x] #2 `CALICUT`/`Calicut`→one city; `BANGALORE`→`Bengaluru`; `Warehouse sale`→`Warehouse Sale` (proven via a real UI upload)
- [x] #3 no literal `// End of KPIs` anywhere
- [x] #4 "Dominant State" renders `Uttar Pradesh`, not a blank tile
- [x] #5 `Star performer` badge; blank rep bucket named `Unattributed` (`repNameCol` in `src/server/base.ts`) and excluded from the star badge
- [x] #6 y-axis reads `₹35.00 L` / `₹1.05 Cr`, not `00000`

### Bugs found and fixed while building (not in the reference)

- [x] `HBar` silently dropped every other y-axis label once rows outgrew the height → chart now grows, `interval={0}`
- [x] `Donut` wrapped the 8-step ramp at slice 9, so colour stopped being a key → `topNWithOther()` folds the tail; `rampColor()` spreads slices across the full ramp so a 2-slice donut contrasts
- [x] Donut legend clipped in narrow cards → `stack` prop
- [x] Admin "Commit Changes" rendered on the Dataset tab, where the form it targets doesn't exist → shown only on Schema Mapping
- [x] Pre-existing: `getProductCities` upper-cased city names (`HYDERABAD`), fighting the new normalization → uses shared `cityNameCol`

### Known gap (carry into M5)

- [x] `orders-controls.tsx` links to `/api/export/orders` — **resolved in M5** (route built; returns a real `.xlsx`, honours filters). See "Bugs found and fixed in M5" below.

## M4 — India heatmap + ad recommendations

- [x] `scripts/build-geo.ts` (`npm run build:geo`) — mapshaper simplify → `public/geo/india-states.topo.json`, **232 KB, committed**
- [x] Source: `geohacker/india` (**MIT**), file `state/india_telengana.geojson` — the only variant in that repo that **contains Telangana**, which is this business's #1 state. License + limitation documented in the script header.
- [x] Build script renames pre-2014 names (`Orissa`→`Odisha`, `Uttaranchal`→`Uttarakhand`, `Andaman and Nicobar`→`…Islands`) to exactly what `normalizeState()` emits, so the join is plain string equality
- [x] `src/lib/geo/city-coords.ts` (116 cities) + `npm run db:seed-geo` (idempotent upsert into `city_geo`)
- [x] `src/server/geo.ts` — `getGeoData()`; left-joins coords so a city with no coordinate becomes **reported unplaced revenue**, never a silent drop
- [x] `<IndiaHeatmap/>`: choropleth (sqrt scale) + bubbles (area-proportional, sorted so metros don't hide small cities), coloured by the quadrant the scatter already computed
- [x] `next/dynamic` + `ssr: false`; projection memoized on the geometry
- [x] Recommendation panel: top-3 `scale` cities by `aov × (medianOrders − orders)`, excluding one-order anecdotes
- [x] Wired into `/opportunity` and `/regions`
- [x] **Verified**: all 36 state shapes render; **0 unmatched** state names; Telangana/Odisha/Uttarakhand present
- [x] **Verified**: `?sp=Website` → shaded states 17→9, bubbles 26→14, active cities 26→14, median basket and recommendations all change
- [x] **Verified**: hover tooltip reads `Chennai, Tamil Nadu · ₹2,48,55,939 · 55 orders`
- [x] **Verified**: map is code-split into its own ~25 KB chunks, not the shared bundle
- [x] **Verified**: renders at 390px (317px wide), no page overflow
- [x] Real recommendation on seeded data: **Patna +₹26,26,630 headroom** (basket ₹4,77,569 on 2 orders vs median 8), then Delhi, Nagpur
- [x] Gate passes

## M5 — Mobile, perf, final verification  *(complete — only externally-blocked items remain)*

- [x] **17/17 routes verified at 390×844** — zero horizontal body overflow; tables scroll inside their own containers; KPI grids 2-up
- [x] **19/19 routes return 200** and contain no `NaN`, no `// End of KPIs`, no `START PERFORMER`, no stub text, no `undefined` leak
- [x] `<Suspense>` + `MapCard`/`MapCardSkeleton` — the map's two heavy queries stream in after the KPIs and recommendations paint
- [x] Route-level `src/app/(app)/loading.tsx` skeleton
- [x] React `cache()` on `getSalespeople()` (was running twice per `/orders` render: layout + page) and `getCurrentUser()`
- [x] Map is in its own ~25 KB chunks, not the shared bundle
- [x] Every animation ≤ 500ms (tokens 120/180/280ms; Recharts pinned to 320ms; max Tailwind class `duration-300`); `prefers-reduced-motion` respected
- [x] Type scale reduced (`html { font-size: 14px }`)

### Bugs found and fixed in M5

- [x] **`/api/export/orders` did not exist** — the "Export to Excel" button 404'd. Built it; honours the current filters; verified it returns a real `.xlsx` (PK zip magic, 153 KB, correct `Content-Disposition`).
- [x] **`/orders/[orderId]` did not exist** — every Order ID in the main table was a dead link. Built the detail page (line items, customer, shipping, payment). An order with a summary row but no line items now *redirects* to its Not-Processed page instead of 404ing.
- [x] **"Refresh Feed" was an `<a href="/api/sync">`** — a GET that navigated the user to raw JSON. Now POSTs via fetch and refreshes in place.
- [x] **"Live Sync Active" badge was hardcoded** — it claimed live sync with no sheet connected. Now reads "Upload Mode" unless credentials *and* a sheet URL both exist.
- [x] Avoided pulling the whole `googleapis` client into the `/orders` server bundle for one boolean.

### Remaining in M5

- [x] **Lighthouse run** (production build, authenticated admin session, headless Chrome, default mobile throttling):
      `/dashboard` → **Perf 83 · A11y 100 · Best-Practices 100 · SEO 100** (FCP 1.4s, LCP 4.2s, TBT 140ms, CLS 0);
      `/opportunity` → **Perf 90 · A11y 100 · Best-Practices 100 · SEO 100** (FCP 0.9s, LCP 3.5s, TBT 130ms, CLS 0).
      LCP is the only sub-90 driver; CLS is a perfect 0 on both. Reports in the job tmp dir.
- [x] **Visual side-by-side against all 41 reference screenshots** (headless-Chrome full-page captures of all
      18 routes at 1440px, authenticated). Every reference maps to a route; layouts match. **All 6 reference
      bugs verified fixed on the rendered pages:** #1 Customers Avg Lifetime Value ₹7,16,194 + VIP Gross Spend
      all real (no ₹NaN); #2 Bengaluru (not Bangalore), Calicut single; #3 no `// End of KPIs`; #4 all states
      named / no blank row; #5 Top Performer "Shikha" (not START PERFORMER: UNKNOWN); #6 compact ₹ axes
      (₹1.00 Cr / ₹75.00 L), not `00000`. All chart types render (line, VBar, HBar, donut, choropleth+bubbles,
      scatter). **No app defects found.** (One capture-tooling caveat: `captureBeyondViewport` fails to
      composite Recharts cartesian charts in headless screenshots — the DOM proved bars present with correct
      geometry/fill; capturing in-viewport renders them. This is a screenshot artifact, not an app bug.)
- [x] **First commit + push to GitHub** — project has its own repo; `main` pushed to
      `admindtale2026/Ecom-Analytics-Pro` (commits `23ab853` build + `ec07a83` docs). Vendored
      `public/geo/india-states.topo.json` (232 KB) included; `.env*` / `.pglite` / `node_modules` excluded.
- [ ] Swap `DATABASE_URL` to Neon and re-run migrations — *deferred by decision* (staying on PGlite until the
      finish line; see the Hosting/Database rows in `PROGRESS.md` + `~/.claude/plans/magical-hopping-wall.md`).
- [ ] End-to-end delta-sync-twice against a **real Google sheet** — *deferred*: needs `GOOGLE_SERVICE_ACCOUNT_JSON`
      (the underlying upsert idempotency is already covered by the M1 synthetic-sheet test).

## M6 — Data-date fix, default filter & security hardening (2026-07-12)

### Sheet-sync date corruption (root cause of "no data before Apr 2026")
- [x] **Bug:** CSV sync read dates as Excel serials (`XLSX.read(text,{raw:false})` +
      `sheet_to_json` default `raw:true`) → `new Date(45748.01)` → **everything collapsed to 1970-01-01**.
      The upload path was fine (`workbook.ts` uses `cellDates:true`); only the sync was broken.
- [x] `src/lib/ingest/sheets.ts` `fetchTabRows` now reads with `cellDates:true` → date cells arrive as JS Dates.
- [x] `parseDate` (`src/lib/ingest/mapping.ts`) hardened + **exported**: passes `Date` through, converts finite
      numbers via the Excel epoch (1899-12-30), else `new Date(String(v))`. `toDate` in `pipeline.ts` reuses it.
- [x] Repro proven: `2025-04-01 0:27:14` → mapped `orderDate` year **2025** (was 1970). PASS.
- [ ] Trigger a **full** sync against the live sheet and confirm 2025 history appears end-to-end (needs the
      running app + reachable sheet; see PROGRESS "Resume here").

### Seed = reference tables only (no synthetic orders)
- [x] `src/db/seed.ts` no longer generates synthetic `order_lines`/`order_summary`/`customers`
      (removed `randomOrderDate` Apr–Jul 2026 generator). Still seeds users/city_geo/data_sources/
      schema_mappings/settings and still **clears** order tables so a re-seed drops stale/1970 rows.

### Default date filter → This Month
- [x] `src/lib/filters.ts` `resolveRange`: explicit `case "all"` (All Time) + `default:` now returns This Month.
- [x] `src/components/layout/filter-bar.tsx`: "All Time" item applies `range:"all"` (persisted), not a cleared key.

### Security hardening
- [x] **Route guard confirmed active** — `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`) builds an
      Auth.js instance from edge-safe `authConfig`; build output lists `ƒ Proxy (Middleware)`. Matcher guards all
      pages, excludes `/api/*` (own auth incl. the cron bearer), `login`, static assets. Function renamed to `proxy`.
- [x] **Defense in depth:** `src/app/(app)/layout.tsx` redirects to `/login` when the user has no email
      (anonymous guest) — no analytics renders without a session even if the proxy is bypassed.
- [x] **Demo backdoor removed:** login page no longer pre-fills `admin@dtalemodern.com / password` and the
      "Demo login is pre-filled" hint is gone.
- [x] **No committed passwords:** seed reads `SEED_ADMIN_PASSWORD` or prints a random one; `.env.example`
      ships empty `AUTH_SECRET`/`CRON_SECRET` with generation instructions + the empty-`CRON_SECRET` warning.
- [x] **Session lifetime:** `auth.config.ts` sets `maxAge` 12h (`updateAge` 1h) instead of the 30-day default.
- [x] Gate passes: `tsc` clean, `eslint` clean, `npm run build` green (`ƒ Proxy (Middleware)` present).
- [ ] Browser-drive the access gate: logged-out `/dashboard` etc. → redirect to `/login`; admin login → loads;
      `/admin/*` still 404 for a `sales` user (needs the running app).
