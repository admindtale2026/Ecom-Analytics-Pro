# PROGRESS — read this first when resuming

**Last updated:** 2026-07-11 — **M0–M5 complete and gated.** Lighthouse + exhaustive visual diff done; first
commit **pushed to GitHub** (`admindtale2026/Ecom-Analytics-Pro`, `main` @ `ec07a83`). Only two items remain,
both **intentionally deferred** (external dependencies, not blockers): the Neon `DATABASE_URL` cutover, and the
delta-sync-twice test against a real Google sheet.

> Dev server runs on **port 3100** in this project (`npm run dev -- --port 3100`), not 3000.
> Check `lsof -nP -iTCP:3100 -sTCP:LISTEN` before starting another.
> Login: `admin@dtalemodern.com` / `password` (all seeded demo users share it).

## Resume here

Everything builds, lints, typechecks, is committed **and pushed to GitHub**, and every route was driven in a
real browser. M0–M5 are done. Both remaining items are **deferred by choice**, not blockers:

1. ~~**Lighthouse run.**~~ **DONE** — prod build + authed admin: dashboard 83/100/100/100,
   opportunity 90/100/100/100 (perf/a11y/bp/seo). LCP is the only <90; CLS 0.
2. ~~**Exhaustive visual diff** against all 41 `screenshots/`.~~ **DONE** — all 18 routes captured, every
   reference mapped, all 6 reference bugs fixed on the rendered pages, no app defects. (Caveat: automated
   screenshots must capture *in-viewport*, not `captureBeyondViewport`, or Recharts cartesian charts appear
   blank in the image only — the app renders them fine.)
3. ~~**First commit + push.**~~ **DONE** — own repo, `main` @ `ec07a83` on GitHub; vendored
   `public/geo/india-states.topo.json` included.
4. **Neon `DATABASE_URL` cutover** — *deferred to the finish line.* Still on local PGlite. Set `DATABASE_URL`
   in `.env.local` (pooled string for the app; **direct** string for migrations), run
   `npm run db:generate && npm run db:migrate && npm run db:seed && npm run db:seed-geo`, **then restart
   `next dev`** (see the PGlite gotcha below). No code changes needed. Runbook:
   `~/.claude/plans/magical-hopping-wall.md`.
5. **Delta-sync-twice against a real Google sheet** — *deferred:* needs `GOOGLE_SERVICE_ACCOUNT_JSON`. Upsert
   idempotency is already proven by the M1 synthetic-sheet test.

This file is the single source of truth for "where did we stop and what's next".
`plan.md` = the approved architecture. `CHECKLIST.md` = the tick-boxes per module.

---

## Decisions locked (do not re-litigate)

| Decision | Choice |
| --- | --- |
| Data source | Excel/CSV **upload works today**; Google Sheets sync coded but dormant until `GOOGLE_SERVICE_ACCOUNT_JSON` is set |
| Sync cadence | Delta hourly + full sync nightly (03:00 IST) via `vercel.json` cron |
| Map data | Vendored TopoJSON, no map API keys. Source: **`geohacker/india` (MIT)** — raw GeoJSON is 23MB, simplify once with `mapshaper` into `public/geo/india-states.topo.json` |
| Hosting | **App → Vercel** (whole Next.js unit; there is no separate backend to split — RSC query Postgres directly, writes via `/api/*` route handlers). `vercel.json` crons already assume Vercel. |
| Database | **Postgres → Neon**, adopted **at the end**. Runtime uses Neon's **pooled** string (matches `client.ts` `prepare:false`); migrations/seeds use the **direct** (unpooled) string. Supabase = viable drop-in; Render declined for this Vercel app. See `~/.claude/plans/magical-hopping-wall.md` for the cutover runbook. |
| Type scale | Smaller than default — `html { font-size: 14px }` |
| Color | Minimal. Single indigo ramp + neutrals. Do **not** reintroduce the reference app's rainbow palette |
| Animation | Butter-smooth, **nothing over 500ms**. Tokens: `--dur-fast: 120ms`, `--dur-base: 180ms`, `--dur-slow: 280ms` |

### Database: PGlite now, Neon at the end (by decision — not a blocker)

We are intentionally running on the **local PGlite fallback** (`.pglite/`) for the remainder
of the build; it works fine and needs no credentials. **Neon is the chosen managed Postgres,
to be wired up at the finish line** — not because it's blocked, but because nothing else
depends on it and the client is env-driven. `src/db/client.ts` is already driver-agnostic, so
adopting Neon is zero code change: set `DATABASE_URL` in `.env.local` (pooled string for the
app; migrate/seed against the direct string) and run
`npm run db:generate && npm run db:migrate && npm run db:seed && npm run db:seed-geo`, then
restart `next dev`. Full step-by-step in `~/.claude/plans/magical-hopping-wall.md`.

---

## Module status

- [x] **M0 — Foundation** (font scale 14px, motion tokens, `normalize.ts`, `row_hash` + indexes, migration `0001_busy_maverick.sql`)
- [x] **M1 — Ingest** (`workbook.ts`, `pipeline.ts`, `POST /api/upload`, `resolveMapping()`) — idempotency + normalization verified through the real UI
- [x] **M2 — Sheets sync** (`sheets.ts`, `/api/sync`, `vercel.json` crons) — 503-when-unconfigured verified
- [x] **M3 — 7 stub pages + detail routes** — all built; `stub.tsx` deleted; all 6 reference bugs fixed
- [x] **M4 — India heatmap + ad recommendations** — vendored MIT TopoJSON, 116-city `city_geo`, choropleth + quadrant bubbles, salesperson-filterable
- [x] **M5 — Mobile + perf + verification** — 390px pass, Suspense streaming, map code-split, export + detail
  routes, Lighthouse (83/90 perf, 100 a11y/bp/seo), exhaustive visual diff (all 6 reference bugs fixed), pushed to GitHub

### What the app does now

12 nav routes + 6 drill-downs. Data enters by **file upload today** (`/admin/settings` →
Native Upload, drag-drop, idempotent) or by **Google Sheets sync** once
`GOOGLE_SERVICE_ACCOUNT_JSON` is set (delta hourly, full nightly via `vercel.json`).
`/opportunity` is the headline feature: an India choropleth with city bubbles coloured by
ad-spend quadrant, plus a ranked "Where to spend next" panel. On the seeded data it recommends
**Patna (+₹26.2L headroom — ₹4.77L basket on only 2 orders vs a median of 8)**, then Delhi and Nagpur.
Every filter (store / salesperson / date) reshapes the map, the recommendations and the scatter,
because they all flow through the one `orderLineWhere()` predicate.

### ⚠ PGlite gotcha that will bite you (cost ~20 min to diagnose)

**PGlite loads the whole database into WASM memory at process start and persists back to the
directory.** It is single-writer. Consequences:

1. **After `npm run db:migrate`, restart `next dev`.** The dev server booted before the migration
   holds a pre-migration schema in memory, so inserts referencing a new column fail with an opaque
   `Failed query: insert into "order_lines" …` and *no cause*. This is exactly what happened with
   `row_hash`.
2. **Never run a `tsx` script that writes to `.pglite` while `next dev` is running.** The two
   processes have divergent in-memory copies and the last one to flush wins. Read-only scripts are
   fine. Restart the dev server afterwards either way.

Both problems disappear once `DATABASE_URL` points at real Postgres — another reason to get that
connection string in.

### Things decided while building (don't undo)

- **No `rollupCustomers()`.** `getCustomers()` (`src/server/customers.ts:56`) derives buyers live from
  `order_lines`. Materialising a `customers` table would be a second source of truth that can drift.
  `safeDivide` alone fixes the `₹NaN` bug. The `customers` table is seed-only.
- **`getCurrentUser()` no longer returns a demo admin in production** (`src/lib/session.ts`). It used
  to, which left `/api/upload` and `/api/sync` — both gated on `role === "admin"` — wide open in any
  deployed build. Production now gets an anonymous no-access user.
- **In-batch dedupe by `rowHash`** in `ingestOrderLines`: Postgres raises "ON CONFLICT DO UPDATE
  cannot affect row a second time" if one statement touches the same conflict target twice.
- `vercel.json` cron times are **UTC**. `30 21 * * *` is 03:00 IST.

### Verified behaviours (re-check if you refactor)

Ingest of a synthetic sheet carrying every reference defect produced:
`CALICUT`+`Calicut`→`Calicut` · `BANGALORE`+`Bengaluru`→`Bengaluru` · `Warehouse sale`+`Warehouse Sale`→`Warehouse Sale`
· `Orissa`→`Odisha` · blank city/state→`NULL` (never `""`) · `"₹1,20,000"`→`120000` · row without an
order id skipped · **6 rows after pass 1, still 6 after pass 2**.

---

## Key facts discovered (so you don't re-derive them)

- **Next.js 16.2.10.** `params` and `searchParams` are **Promises** and must be awaited. A global
  `PageProps<'/route/[x]'>` helper is available (no import needed) and is the preferred typing.
  Existing pages use `export const dynamic = "force-dynamic"` because they read `searchParams`.
- **The server layer is complete.** Every stub page has its query functions already written in
  `src/server/*.ts` (~1200 lines). Wire the UI to these — do not rewrite them.
  In particular `getOpportunityCities()` in `src/server/opportunity.ts` **already** classifies
  cities into scale/defend/nurture/hold quadrants against the *median* city.
- `src/lib/ingest/mapping.ts` already has `CANONICAL_FIELDS`, `defaultMapping()`, and `mapRow()`.
  Both the upload path and the Sheets path must funnel through `mapRow()` — do not write a second parser.
- `src/lib/utils.ts` already has `formatCurrency` (NaN-guarded), `compactNumber` (K/L/Cr),
  and `safeDivide`. Bug #1 and #6 below are mostly handled at this layer already.
- `src/db/schema.ts` already declares the `cityGeo` and `schemaMappings` tables — they just need seeding/UI.
- TopoJSON probe results: `udit-001/india-maps-data` has a ready-made 483KB file with **both**
  `states` (36) and `districts` (723) objects, properties `{st_nm, st_code}` / `{district, dt_code, ...}` —
  but the repo declares **no license**, so we rejected it. `datameet/maps` is MIT but ships 17MB
  shapefiles needing GDAL. **`geohacker/india` is MIT with GeoJSON** → chosen, simplify via mapshaper.

### Reference-app bugs to FIX, not copy (seen in `screenshots/`)

1. `₹NaN` — Customers page "Avg Lifetime Value" and every "Gross Spend" cell.
2. `Calicut` vs `CALICUT` rank as two separate cities; likewise `Bengaluru`/`Bangalore`, and
   `Warehouse sale`/`Warehouse Sale` in the Category Mix legend.
3. `// End of KPIs` — a literal source comment rendered on Regions → state detail.
4. Blank labels — an unnamed state row holding ₹22.7M, and a blank "Dominant State" KPI.
5. `START PERFORMER: UNKNOWN` — typo for `STAR PERFORMER`; also fold `Unknown` salesperson into
   an "Unattributed" bucket rather than ranking it #1.
6. Truncated y-axis labels (`00000`) on State Sales — use `compactNumber` (`₹1.2Cr`).

---

## Spec for the next file to write: `src/lib/ingest/normalize.ts`

Purpose: fix bug #2 at **write** time, so every query, chart, and the map all agree on one spelling.

```ts
export const UNKNOWN = "Unknown";

// Trim, collapse internal whitespace, Title Case. "CALICUT" -> "Calicut".
export function titleCase(raw: unknown): string | null;

// titleCase + alias map. "BANGALORE" -> "Bengaluru".
export function normalizeCity(raw: unknown): string | null;

// titleCase + alias map, canonicalized to the `st_nm` values in the TopoJSON
// so the choropleth joins cleanly. "Orissa" -> "Odisha", "Pondicherry" -> "Puducherry",
// "Uttaranchal" -> "Uttarakhand", "NCT of Delhi"/"New Delhi" -> "Delhi",
// "Tamilnadu" -> "Tamil Nadu", "Telengana" -> "Telangana".
export function normalizeState(raw: unknown): string | null;

// Generic label collapse for productType / productCategory:
// "Warehouse sale" and "Warehouse Sale" -> one value.
export function normalizeLabel(raw: unknown): string | null;
```

Keep the alias maps as exported **data** (plain objects), not inline `if`s — a real upload will
surface more aliases than the screenshots show, and the admin should be able to extend them.

Null/empty must return `null`, and the display layer renders `UNKNOWN` — that is the fix for bug #4.
Then apply these inside the ingest pipeline right after `mapRow()`, before insert.

## Spec for `rowHash` (idempotency, M1)

Identity of an order line = `sha1(orderId | sku | productName | dimension | fabric | polishFinish)`
— i.e. the **immutable** descriptors only. Mutable fields (quantity, paymentAmount, status,
dispatch dates) are what the upsert *updates* on conflict. This makes re-running a delta sync a
no-op instead of duplicating rows. Full sync writes a new `syncBatchId`, then deletes rows from
prior batches in the same transaction.

---

## Verification gate (run after every module)

```bash
npx tsc --noEmit && npx eslint && npm run build
```
Then drive the real app — not just the typechecker:
`npm run dev`, and use Playwright MCP to visit each route at **1440×900** and **390×844**,
comparing against the matching reference image in `screenshots/`.

Specific assertions:
- No `NaN` anywhere on Customers. `Calicut` appears exactly once. No `// End of KPIs` string.
- No blank state row. `STAR PERFORMER`. Axis labels legible.
- Heatmap: switching salesperson to `Website` changes both the choropleth and the recommended cities.
- Idempotency: run delta sync twice, assert `count(*)` on `order_lines` is unchanged.
- `npm run build` — confirm the map lands in its own chunk, not the shared bundle.
