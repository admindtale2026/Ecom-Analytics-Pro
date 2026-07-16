/**
 * Canonical field catalogue + row transformer.
 * Mirrors the Admin "Schema Mapping" screen: each canonical field has a
 * default source-column header (as seen in the reference sheet). Admins can
 * remap source columns without code changes.
 */

export type CanonicalField = {
  key: string; // canonical id
  label: string; // shown in Admin UI
  defaultColumn: string; // default source column header
  column: keyof RawMappedLine; // target property on order_lines
  kind: "text" | "number" | "date";
};

/** Shape produced by the transformer (matches order_lines insert fields). */
export type RawMappedLine = {
  orderId: string;
  invoiceNo: string | null;
  orderDate: Date | null;
  productName: string | null;
  productCategory: string | null;
  productType: string | null;
  sku: string | null;
  quantity: number;
  paymentAmount: number;
  status: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipCountry: string | null;
  shipCustomerName: string | null;
  shipEmail: string | null;
  shipMobile: string | null;
  shipAddress: string | null;
  shipZip: string | null;
  salesPerson: string | null;
  imageUrl: string | null;
  fabric: string | null;
  dimension: string | null;
  polishFinish: string | null;
  committedDeliveryDate: Date | null;
  dispatchedDate: Date | null;
  extendedDate: Date | null;
  trackingNumber: string | null;
  remarks: string | null;
  paymentType: string | null;
  billingCustomerName: string | null;
  billAddress: string | null;
  billCity: string | null;
  billState: string | null;
  billCountry: string | null;
  billZip: string | null;
  billMobile: string | null;
  billEmail: string | null;
};

export const CANONICAL_FIELDS: CanonicalField[] = [
  { key: "orderId", label: "Order ID", defaultColumn: "OrderId", column: "orderId", kind: "text" },
  { key: "invoiceNo", label: "Invoice No", defaultColumn: "Invoice No", column: "invoiceNo", kind: "text" },
  { key: "orderDate", label: "Date", defaultColumn: "Order Date Time", column: "orderDate", kind: "date" },
  { key: "productName", label: "Product", defaultColumn: "Product Name", column: "productName", kind: "text" },
  { key: "productCategory", label: "Category", defaultColumn: "Product Catagory", column: "productCategory", kind: "text" },
  { key: "sku", label: "SKU", defaultColumn: "Sku", column: "sku", kind: "text" },
  { key: "quantity", label: "Quantity", defaultColumn: "Order Quantity", column: "quantity", kind: "number" },
  { key: "paymentAmount", label: "Revenue / Payment Amount", defaultColumn: "Payment Amount", column: "paymentAmount", kind: "number" },
  { key: "status", label: "Status", defaultColumn: "Status", column: "status", kind: "text" },
  { key: "shipCity", label: "City", defaultColumn: "Ship City Name", column: "shipCity", kind: "text" },
  { key: "shipState", label: "State", defaultColumn: "Ship State Name", column: "shipState", kind: "text" },
  { key: "shipCountry", label: "Country", defaultColumn: "Ship Country Name", column: "shipCountry", kind: "text" },
  { key: "shipCustomerName", label: "Customer Name", defaultColumn: "Shipping Customer Name", column: "shipCustomerName", kind: "text" },
  { key: "shipEmail", label: "Customer Email", defaultColumn: "Ship Email", column: "shipEmail", kind: "text" },
  { key: "shipMobile", label: "Customer Phone", defaultColumn: "Ship Mobile", column: "shipMobile", kind: "text" },
  { key: "salesPerson", label: "Salesperson", defaultColumn: "Sales Person", column: "salesPerson", kind: "text" },
  { key: "imageUrl", label: "Product Image URL", defaultColumn: "Image Url", column: "imageUrl", kind: "text" },
  { key: "productType", label: "Product Type", defaultColumn: "Product Type", column: "productType", kind: "text" },
  { key: "fabric", label: "Fabric", defaultColumn: "Fabric", column: "fabric", kind: "text" },
  { key: "dimension", label: "Dimension", defaultColumn: "Dimension", column: "dimension", kind: "text" },
  { key: "polishFinish", label: "Polish Finish", defaultColumn: "Polish Finish", column: "polishFinish", kind: "text" },
  { key: "committedDeliveryDate", label: "Committed Delivery Date", defaultColumn: "Committed Delivery Date", column: "committedDeliveryDate", kind: "date" },
  { key: "dispatchedDate", label: "Dispatched Date", defaultColumn: "Dispatched Date", column: "dispatchedDate", kind: "date" },
  { key: "extendedDate", label: "Extended Date", defaultColumn: "Extended Date", column: "extendedDate", kind: "date" },
  { key: "trackingNumber", label: "Tracking Number", defaultColumn: "Tracking Number", column: "trackingNumber", kind: "text" },
  { key: "remarks", label: "Remarks", defaultColumn: "Remarks", column: "remarks", kind: "text" },
  { key: "paymentType", label: "Payment Type", defaultColumn: "Payment Type", column: "paymentType", kind: "text" },
  { key: "billingCustomerName", label: "Billing Name", defaultColumn: "Billing Customer Name", column: "billingCustomerName", kind: "text" },
  { key: "billAddress", label: "Billing Address", defaultColumn: "Bill Address", column: "billAddress", kind: "text" },
  { key: "billCity", label: "Billing City", defaultColumn: "Bill City", column: "billCity", kind: "text" },
  { key: "billState", label: "Billing State", defaultColumn: "Bill State", column: "billState", kind: "text" },
  { key: "billCountry", label: "Billing Country", defaultColumn: "Bill Country", column: "billCountry", kind: "text" },
  { key: "billZip", label: "Billing Zip", defaultColumn: "Bill Zip", column: "billZip", kind: "text" },
  { key: "billMobile", label: "Billing Mobile", defaultColumn: "Bill Mobile", column: "billMobile", kind: "text" },
  { key: "billEmail", label: "Billing Email", defaultColumn: "Bill Email", column: "billEmail", kind: "text" },
  { key: "shipAddress", label: "Shipping Address", defaultColumn: "Ship Address", column: "shipAddress", kind: "text" },
  { key: "shipZip", label: "Shipping Zip", defaultColumn: "Ship Zip", column: "shipZip", kind: "text" },
];

export type Mapping = Record<string, string>; // canonicalKey -> sourceColumn

export function defaultMapping(): Mapping {
  return Object.fromEntries(CANONICAL_FIELDS.map((f) => [f.key, f.defaultColumn]));
}

function parseNumber(v: unknown): number {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Excel serial-date epoch is 1899-12-30 (accounts for the 1900 leap-year bug). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** `d/m/yyyy` or `d-m-yyyy`, with an optional trailing clock. */
const DMY_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Parse a `d/m/yyyy` string as day-first, rejecting anything that isn't a real
 * calendar date. The round-trip check matters because the Date constructor rolls
 * overflow forward — `31/02` would silently become 3 March — and a wrong date is
 * worse than no date.
 */
function parseDayFirst(s: string): Date | null {
  const m = DMY_RE.exec(s);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day, Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/**
 * Parse a date cell defensively, regardless of what the reader hands us:
 *  - a JS Date (upload path, or CSV read with `cellDates:true`) → pass through;
 *  - a finite number = an Excel serial date → convert via the Excel epoch,
 *    NOT `new Date(n)` (which would read it as ms-since-1970 → year 1970);
 *  - anything else → `new Date(String(v))`.
 *
 * `dayFirst` opts a source into DD/MM/YYYY for *text* dates only. It exists
 * because `new Date("13/06/2026")` is not a parse failure the caller can see —
 * it is `Invalid Date` for days past the 12th and, worse, a silently wrong month
 * for days 1-12 ("12/06/2026" → 6 December). Only turn it on for a source whose
 * text dates are known day-first; a column mixing both conventions cannot be
 * resolved here and must be fixed upstream. Date and serial cells are already
 * unambiguous, so the flag never touches them.
 */
export function parseDate(v: unknown, opts: { dayFirst?: boolean } = {}): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const d = new Date(EXCEL_EPOCH_MS + v * 86400000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (opts.dayFirst) {
    const dmy = parseDayFirst(s);
    if (dmy) return dmy;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Normalise a header for tolerant matching: trim, lowercase, drop spaces and
 * underscores. Lets one mapping match `OrderId` / `Order Id` / `Order ID ` (the
 * store tabs are inconsistent, and several carry trailing spaces).
 */
function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_]+/g, "");
}

/** Transform one raw source row (keyed by source column header) into a mapped line. */
export function mapRow(row: Record<string, unknown>, mapping: Mapping): RawMappedLine | null {
  // Index the row's headers once, normalised, for tolerant fallback lookups.
  const normIndex = new Map<string, unknown>();
  for (const k of Object.keys(row)) normIndex.set(normHeader(k), row[k]);
  const get = (key: string) => {
    const src = mapping[key];
    if (!src) return undefined;
    if (src in row) return row[src]; // exact header wins
    return normIndex.get(normHeader(src)); // tolerant fallback
  };
  const orderId = str(get("orderId"));
  if (!orderId) return null; // rows without an order id are unusable
  // These sheets carry a repeated header row mid-data; its order-id cell is the
  // literal column name ("OrderId"/"Order Id"). Drop it so it can't become a
  // phantom ₹0 order (and leak "Ship State Name" into the state list).
  if (normHeader(orderId) === "orderid") return null;

  const out = {} as RawMappedLine;
  for (const f of CANONICAL_FIELDS) {
    const raw = get(f.key);
    if (f.kind === "number") {
      (out[f.column] as number) = parseNumber(raw);
    } else if (f.kind === "date") {
      (out[f.column] as Date | null) = parseDate(raw);
    } else {
      (out[f.column] as string | null) = str(raw);
    }
  }
  out.orderId = orderId;
  return out;
}
