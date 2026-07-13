# PROGRESS — read this first when resuming

**Last updated:** 2026-07-13 — **M0–M6 complete, gated, and browser-verified.** M6 (data-date fix, default
filter This Month + **smart fallback to latest month with data**, security hardening) is done and driven in a
real browser. **Neon adopted and loaded**: `DATABASE_URL` (direct endpoint) is live in `.env.local`, migrated +
seeded + full-synced — Neon holds **6,382 order_lines spanning 2025-03-31 → 2026-06-30** (users 4, order_summary
2,018, city_geo 117). Login, per-store clamp, and the anonymous access gate all verified against Neon. Gate green
(`tsc`/`eslint`/`build`, `ƒ Proxy (Middleware)`). Remaining deferred: delta-sync-twice on a real sheet (idempotency
already re-proven — a second `npm run db:sync` left counts at 6,382); set the Neon **pooler** string + prod
`AUTH_SECRET`/`CRON_SECRET` in Vercel at deploy.

> Dev server runs on **port 3100** in this project (`npm run dev -- --port 3100`), not 3000.
> Check `lsof -nP -iTCP:3100 -sTCP:LISTEN` before starting another.
> Login: demo credential pre-fill was **removed** (security). Seed no longer hardcodes a password —
> `npm run db:seed` prints a random one (or set `SEED_ADMIN_PASSWORD`). Seeded admin email: `admin@dtalemodern.com`.

## M6 — Data-date fix, default filter & security hardening (2026-07-12)

- **Fixed the "no data before April 2026" bug.** The Sheet CSV sync was reading datetime cells as **Excel
  serial numbers** and `new Date(serial)` read them as ms-since-1970, so every synced order collapsed to
  1970-01-01 (the upload path was always fine). Fix: `src/lib/ingest/sheets.ts` reads with `cellDates:true`,
  and `parseDate` (`mapping.ts`, now exported and reused by `pipeline.ts`'s `toDate`) handles Date/serial/string.
  The only correctly-dated rows before this were the **synthetic seed** orders, hardcoded to Apr–Jul 2026.
- **Seed is reference-only now.** `src/db/seed.ts` stops generating synthetic orders; it seeds users/geo/
  data_sources/schema_mappings/settings and clears order tables (so a re-seed also drops stale/1970 rows).
  **Real order history comes from a sheet sync**, not the seed. → Run a **full** sync to populate.
- **Default date filter is This Month, with a smart fallback.** `resolveRange` (`src/lib/filters.ts`) defaults to
  `thisMonth`; "All Time" is an explicit `range=all` choice. Because the sample sheet's latest order is 2026-06-30
  (today is 2026-07-13), a strict This Month loads empty, so `getFilters` (`src/lib/filters-server.ts`) now falls
  back to the **most recent month that has orders** (label e.g. "Jun 2026") when — and only when — no range was
  explicitly chosen and This Month is empty. The date button shows the server-resolved `rangeLabel`.
  The filter cookie key was bumped `ea_filters` → **`ea_filters_v2`** so a stale `range=all` cookie is retired.
- **Security tightened (verified).** Route guard is `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`; build
  lists `ƒ Proxy (Middleware)`), matcher guards all pages and excludes `/api/*` (they self-auth, incl. the cron
  bearer). Layout-level redirect for the anonymous guest, no login-page demo pre-fill, no committed
  passwords/secrets (seed prints/uses `SEED_ADMIN_PASSWORD`), session `maxAge` 12h, no self-registration.
  **New in this pass, all browser-verified against Neon:**
  - **Backdoor closed.** `getCurrentUser()` (`src/lib/session.ts`) no longer returns a `DEMO_ADMIN` outside
    production — it fails closed to `ANONYMOUS` everywhere. Verified: unauth `/api/sync`→401, `/api/upload`→403,
    `/api/export/orders`→401, pages→`/login`.
  - **Per-store access enforced.** `assertStoreAccess`/`canAccessStore` (`session.ts`); `getFilters` clamps an
    out-of-scope `store` to the caller's first allowed store; the store switcher (`filter-bar.tsx`) only lists
    allowed stores. Verified: decor-scoped "Lijith" with a forged `store=modern` cookie stays on Decor.
  - **New members require explicit store scope** — `addTeamMember` (`admin-actions.ts`) + a store-checkbox group
    on the add-member form; admins implicitly get all stores.
  - **Prod refuses to boot without a strong `AUTH_SECRET`** (`src/auth.ts`); `/api/sync` warns if `CRON_SECRET`
    is unset in prod.

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
| Data source | **Live: public Google Sheet over CSV** (no service account). One link-shared sheet, 6 grids = 3 stores × (summary+detail), mapped in `src/lib/ingest/sheet-manifest.ts`. Excel/CSV upload still works. Real counts: modern 5329 lines/1758 summaries, homes 1050/254, decor 3/6. |
| Sync cadence | Delta hourly + full sync nightly (03:00 IST) via `vercel.json` cron |
| Map data | Vendored TopoJSON, no map API keys. Source: **`geohacker/india` (MIT)** — raw GeoJSON is 23MB, simplify once with `mapshaper` into `public/geo/india-states.topo.json` |
| Hosting | **App → Vercel** (whole Next.js unit; there is no separate backend to split — RSC query Postgres directly, writes via `/api/*` route handlers). `vercel.json` crons already assume Vercel. |
| Database | **Postgres → Neon**, adopted **at the end**. Runtime uses Neon's **pooled** string (matches `client.ts` `prepare:false`); migrations/seeds use the **direct** (unpooled) string. Supabase = viable drop-in; Render declined for this Vercel app. See `~/.claude/plans/magical-hopping-wall.md` for the cutover runbook. |
| Type scale | Smaller than default — `html { font-size: 14px }` |
| Color | Minimal. Single indigo ramp + neutrals. Do **not** reintroduce the reference app's rainbow palette |
| Animation | Butter-smooth, **nothing over 500ms**. Tokens: `--dur-fast: 120ms`, `--dur-base: 180ms`, `--dur-slow: 280ms` |

### Database: Neon adopted (2026-07-13)

**Now on Neon.** `DATABASE_URL` is set in `.env.local` to the Neon **direct** endpoint
(`ep-restless-hat-…neon.tech`), which works for both the app (client uses `max:1, prepare:false`)
and migrations/seeds. `src/db/client.ts` auto-selects postgres-js when `DATABASE_URL` is present,
so this was zero code change. Load sequence used:
`db:migrate && db:seed && db:seed-geo && db:sync` (the new `db:sync` = `scripts/sync-all-once.ts`,
which preloads `.env.local` via `scripts/_load-env.ts` **before** importing the DB client — required
because the client reads `DATABASE_URL` eagerly at import). PGlite remains the automatic local
fallback when `DATABASE_URL` is unset. **For Vercel:** use Neon's **pooler** string for `DATABASE_URL`
and keep the direct string for migrate/seed; set prod `AUTH_SECRET`/`CRON_SECRET`. Runbook:
`~/.claude/plans/magical-hopping-wall.md`.

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
