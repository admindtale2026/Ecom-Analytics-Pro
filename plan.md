# EcomAnalytics Pro — completion plan

## Context

You want a fast, mobile-responsive Next.js ecommerce analytics app that reads from Excel/Google
Sheets, matching the UI in `screenshots/` (41 images of the reference app at dtalestudio.com), plus
a new India heatmap that recommends where to spend ad budget.

**Work was already started and interrupted.** Current state (verified: `tsc --noEmit` passes):

| Layer | Status |
| --- | --- |
| Next.js 16.2.10 + React 19 + Tailwind v4 + Drizzle | done |
| DB schema (`src/db/schema.ts`), auth, app shell, sidebar, filter bar, charts | done |
| Server query layer — all 12 modules in `src/server/` (~1200 lines) | **done** |
| Pages: dashboard, orders, analytics, analytics/[type] | done |
| Pages: sales-team, customers, inventory, not-processed, regions, opportunity, admin/users, admin/settings | **`<Stub/>` placeholders** |
| Excel upload, Sheets sync, `/api/sync` cron | **missing** |
| India map, `city_geo` seed data, geo assets | **missing** |

So the work stopped right after the data layer landed and before the UI for 7 pages, the ingest
pipeline, and the map were built. The server functions those pages need already exist — this plan
wires them up rather than rewriting them.

**Decisions locked (from your answers):** file upload works today with Sheets sync coded but dormant
until credentials exist; delta sync hourly + full sync nightly; vendored TopoJSON (no map API keys);
managed Postgres via `DATABASE_URL`.

### Bugs in the reference app to fix, not copy

Found while reading the screenshots. These are real defects in the app being cloned:

1. **`₹NaN`** — Customers page "Avg Lifetime Value" and every "Gross Spend" cell.
2. **`Calicut` vs `CALICUT`** rank as two separate cities (Analytics → Regional Dominance); same for
   `Bengaluru`/`Bangalore` and `Warehouse sale`/`Warehouse Sale` in the Category Mix legend.
3. **`// End of KPIs`** — a literal source comment rendered on the Regions → state detail page.
4. **Blank labels** — an unnamed state row in Regions (₹22.7M of revenue attributed to `""`) and a
   blank "Dominant State" KPI.
5. **`START PERFORMER: UNKNOWN`** — typo for `STAR PERFORMER`, and `Unknown` is a real salesperson in
   the ranking rather than being folded into an "Unattributed" bucket.
6. **Truncated axis labels** — State Sales y-axis reads `00000`, `00000`, `00000` (the `₹` and lead
   digits are clipped). Compact INR formatting (`₹1.2Cr`) fixes this.

---

## Architecture

### Ingest — one path, two sources

Both sources converge on `mapRow()` in `src/lib/ingest/mapping.ts`, which already transforms a raw
row using the admin-editable column mapping. Neither source needs its own parser.

```
.xlsx / .csv upload ─┐
                     ├─► rows[] ─► mapRow(row, mapping) ─► normalize() ─► upsert ─► rollupCustomers()
Google Sheets API ───┘
```

- `src/lib/ingest/normalize.ts` (new) — the fix for bug #2. Trim + title-case city/state, apply an
  alias map (`BANGALORE|Bengaluru → Bengaluru`), and canonicalize state names to match the `st_nm`
  property in the TopoJSON so the map joins cleanly. Applied at **write** time so every query,
  chart, and the map all agree.
- **Idempotency**: add `row_hash` to `order_lines` + `uniqueIndex(store_id, row_hash)`. Delta sync
  upserts on conflict; re-running a sync can never duplicate rows. `sync_batch_id` (already in the
  schema) drives full sync: write the new batch, then delete rows from prior batches in one tx.
- `rollupCustomers()` recomputes the `customers` table (identity-matched per the Identity Logic tab)
  after every ingest. This is where `₹NaN` (bug #1) dies — `safeDivide` in `src/lib/utils.ts`.

### Sync scheduling

`/api/sync?mode=delta|full`, guarded by `CRON_SECRET` (already in `.env.example`). `vercel.json`
schedules delta hourly and full at 03:00 IST. The Admin panel's **Delta Sync** / **Full Sync**
buttons hit the same route, so manual and scheduled paths share one code path. Without
`GOOGLE_SERVICE_ACCOUNT_JSON` set, the route returns a clear "not configured" response instead of
throwing — the app stays fully usable on uploads alone.

### The India heatmap (`/opportunity`)

`getOpportunityCities()` in `src/server/opportunity.ts` **already** classifies cities into
scale/defend/nurture/hold quadrants against the *median* city. The scatter chart consuming it exists.
Only the map itself is missing.

- **Geo asset**: `geohacker/india` (MIT). Raw GeoJSON is 23MB, so a one-time
  `scripts/build-geo.ts` simplifies it with `mapshaper` (new devDependency) and emits
  `public/geo/india-states.topo.json` (~150KB, committed). Districts stay out of v1 — state
  choropleth + city bubbles answer the "where do I spend" question, and 723 district paths would
  cost more than they inform.
- **City bubbles**: seed `city_geo` (table already exists) with lat/lng for ~200 Indian cities.
- **Render**: choropleth by state revenue + bubbles sized by revenue and colored by quadrant.
  `d3-geo` + `topojson-client` are already in `package.json`. Plain SVG, `next/dynamic` with
  `ssr: false`.
- **Recommendation panel**: ranks `scale`-quadrant cities by `aov × (medianOrders − orders)` —
  the headroom estimate — and names the top 3 as suggested ad targets.
- Every filter (store, **salesperson**, date) flows through `orderLineWhere()`, so "show me where
  Website sales come from vs Lijith's" works with no extra code.

### Performance

The pages are Server Components reading Postgres directly — no API round-trip, no client fetching.
On top of that: `<Suspense>` so KPI cards paint before the heavy charts; React `cache()` to dedupe
repeated queries within a render; composite indexes on `(store_id, order_date)`,
`(store_id, ship_state)`, `(store_id, sales_person)`; the map lazy-loaded and its projection memoized.

---

## Build sequence

Each module ends with the same gate: `tsc --noEmit` → `eslint` → `next build` → drive the real page
in a browser at 1440px and 390px and compare against the reference screenshot. `CHECKLIST.md` is
ticked only after that gate passes.

**M0 — Foundation.** `plan.md` + `CHECKLIST.md`. Point Drizzle at `DATABASE_URL`, generate and run
the migration (adds `row_hash`, composite indexes). `normalize.ts` + `formatCompactINR()`.
*Blocked on you: I need the Supabase/Neon connection string.*

**M1 — Ingest.** `xlsx` parse → `mapRow` → normalize → upsert. `POST /api/upload`. `rollupCustomers()`.
Verify by uploading a real sheet and checking row counts and that no `NaN` reaches the DB.

**M2 — Sheets sync.** `src/lib/ingest/sheets.ts`, `/api/sync`, `vercel.json` crons. Verify the
unconfigured path returns 503-with-reason, and delta-sync twice in a row leaves row count unchanged.

**M3 — Pages (the bulk).** Seven stubs → real pages, reusing the existing `src/server/*` functions:
sales-team (+ `[name]` detail), customers, inventory (+ product detail), not-processed
(+ `[orderId]` detail), regions (+ state and city detail), admin panel (4 tabs: Dataset Connection,
Schema Mapping, Team Access, Identity Logic — one `AdminPanel` component serving both admin routes).
Fix bugs #1, #3, #4, #5, #6 here.

**M4 — Geo + heatmap.** `scripts/build-geo.ts`, commit the TopoJSON, seed `city_geo`, build
`<IndiaHeatmap/>` and the recommendation panel, wire into `/opportunity` and `/regions`.

**M5 — Polish.** Mobile pass on all 12 routes (tables → horizontal scroll containers, KPI grids →
2-up). Suspense boundaries, bundle check, Lighthouse.

---

## Verification

Not just "it typechecks" — I'll drive the actual app:

1. `npm run dev`, then Playwright MCP to navigate each of the 12 routes.
2. Screenshot each at **1440×900** and **390×844**, compared side-by-side against the corresponding
   reference screenshot in `screenshots/`.
3. Confirm each bug fix against the reference defect: no `NaN` on Customers; `Calicut` appears once;
   no `// End of KPIs` string; no blank state row; `STAR PERFORMER`; axis labels legible.
4. Heatmap: toggle salesperson to `Website`, confirm the choropleth and the recommended cities both
   change; hover a state for the tooltip.
5. Idempotency: run delta sync twice, assert `count(*)` is unchanged.
6. `next build` and confirm the map is in its own chunk, not the shared bundle.

## Risks

- **`DATABASE_URL` is a hard blocker for M0.** If you'd rather I keep moving, I can build M1–M5
  against the existing local PGlite and flip the connection string at the end — the client in
  `src/db/client.ts` is already driver-agnostic, so this costs nothing.
- The reference app's sheet has messy geography (blank states, case-variant cities). `normalize.ts`
  handles the cases I can see in the screenshots; a real upload may surface more aliases, which is
  why the alias map is data, not code.
- Districts are deferred. If you want district-level heat later, the same TopoJSON source has them.
