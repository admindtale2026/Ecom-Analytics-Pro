/**
 * Geography + label canonicalisation, applied at *write* time (right after
 * `mapRow`, before insert) so that every query, chart, table and the choropleth
 * all group on one spelling.
 *
 * The reference app normalised nothing, which is why it ranks "Calicut" and
 * "CALICUT" as two cities, splits Bengaluru's revenue across "Bengaluru" and
 * "Bangalore", and shows both "Warehouse sale" and "Warehouse Sale" in one
 * legend. Fixing it on read would mean repeating the fix in ~12 query modules.
 *
 * The alias maps are exported data rather than inline branches: a real sheet
 * will surface spellings these screenshots never showed, and admins extend the
 * maps without a code change.
 */

/** Rendered wherever a source value was blank. Never store this — store null. */
export const UNKNOWN = "Unknown";

/** Words that stay lowercase inside a name, and abbreviations that stay upper. */
const LOWER_WORDS = new Set(["and", "of", "the", "de", "da"]);
const UPPER_WORDS = new Set(["nct", "ii", "iii"]);

function clean(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/**
 * "CALICUT" -> "Calicut", "  new   delhi " -> "New Delhi".
 * Splits on spaces and hyphens so "Jammu-Kashmir" title-cases both halves,
 * and preserves the separator.
 */
export function titleCase(raw: unknown): string | null {
  const s = clean(raw);
  if (!s) return null;
  return s
    .toLowerCase()
    .split(/(\s|-)/)
    .map((part, i) => {
      if (part === " " || part === "-") return part;
      if (UPPER_WORDS.has(part)) return part.toUpperCase();
      // Interior filler words stay lowercase; the first word never does.
      if (i > 0 && LOWER_WORDS.has(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

/**
 * City aliases. Key is the already-title-cased form, value is canonical.
 * Only unambiguous same-city pairs belong here — renaming a city the business
 * actually says out loud (Gurgaon, Calicut) would confuse more than it fixes,
 * so those are left alone and merely case-normalised.
 */
export const CITY_ALIASES: Record<string, string> = {
  Bangalore: "Bengaluru",
  // Real-sheet variants of Bengaluru — misspellings and district suffixes the
  // source uses interchangeably for the same city.
  Banglore: "Bengaluru",
  Bangaluru: "Bengaluru",
  Bangalur: "Bengaluru",
  "Bengaluru Urban": "Bengaluru",
  "Bangalore Urban": "Bengaluru",
  "Bangalore Rural": "Bengaluru",
  "Bangalore North": "Bengaluru",
  "Bangalore South": "Bengaluru",
  Bombay: "Mumbai",
  Calcutta: "Kolkata",
  Madras: "Chennai",
  Poona: "Pune",
  Trivandrum: "Thiruvananthapuram",
  Baroda: "Vadodara",
  Cochin: "Kochi",
  Gurugram: "Gurgaon",
};

/**
 * State aliases, canonicalised to the `st_nm` property used by the vendored
 * India TopoJSON. If a state name here does not match `st_nm` exactly, that
 * state renders as a hole in the choropleth.
 */
export const STATE_ALIASES: Record<string, string> = {
  Orissa: "Odisha",
  Pondicherry: "Puducherry",
  Uttaranchal: "Uttarakhand",
  "New Delhi": "Delhi",
  "NCT of Delhi": "Delhi",
  "Delhi NCR": "Delhi",
  Tamilnadu: "Tamil Nadu",
  Telengana: "Telangana",
  "Jammu & Kashmir": "Jammu and Kashmir",
  "Andaman & Nicobar": "Andaman and Nicobar Islands",
  "Andaman & Nicobar Islands": "Andaman and Nicobar Islands",
  // The 2020 merger of these two UTs is not reflected in the map's geometry,
  // which still draws them separately — so we keep them separate too.
  "Dadra & Nagar Haveli": "Dadra and Nagar Haveli",
  "Daman & Diu": "Daman and Diu",
};

export function normalizeCity(raw: unknown): string | null {
  const t = titleCase(raw);
  if (!t) return null;
  return CITY_ALIASES[t] ?? t;
}

export function normalizeState(raw: unknown): string | null {
  const t = titleCase(raw);
  if (!t) return null;
  return STATE_ALIASES[t] ?? t;
}

/**
 * Collapse free-text labels (product type, category, status) that differ only
 * by case or stray whitespace. Unlike city/state there is no alias map — the
 * source vocabulary is the business's own and we only fold case.
 */
export function normalizeLabel(raw: unknown): string | null {
  return titleCase(raw);
}

/** Display helper: turn a stored null into the "Unknown" bucket. */
export function displayOrUnknown(value: string | null | undefined): string {
  return value && value.trim() !== "" ? value : UNKNOWN;
}
