import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * order_lines: one row per line-item from the detailed orders sheet/upload.
 * Mirrors the ~40 canonical fields exposed in the reference app's Schema Mapping.
 */
export const orderLines = pgTable(
  "order_lines",
  {
    id: serial("id").primaryKey(),
    storeId: text("store_id").notNull(),
    orderId: text("order_id").notNull(),
    invoiceNo: text("invoice_no"),
    orderDate: timestamp("order_date", { withTimezone: false }),
    // product
    productName: text("product_name"),
    productCategory: text("product_category"),
    productType: text("product_type"),
    sku: text("sku"),
    quantity: integer("quantity").default(0).notNull(),
    paymentAmount: doublePrecision("payment_amount").default(0).notNull(),
    status: text("status"),
    // shipping location
    shipCity: text("ship_city"),
    shipState: text("ship_state"),
    shipCountry: text("ship_country"),
    shipCustomerName: text("ship_customer_name"),
    shipEmail: text("ship_email"),
    shipMobile: text("ship_mobile"),
    shipAddress: text("ship_address"),
    shipZip: text("ship_zip"),
    // sales + product meta
    salesPerson: text("sales_person"),
    imageUrl: text("image_url"),
    fabric: text("fabric"),
    dimension: text("dimension"),
    polishFinish: text("polish_finish"),
    // fulfilment dates
    committedDeliveryDate: timestamp("committed_delivery_date"),
    dispatchedDate: timestamp("dispatched_date"),
    extendedDate: timestamp("extended_date"),
    trackingNumber: text("tracking_number"),
    remarks: text("remarks"),
    paymentType: text("payment_type"),
    // billing
    billingCustomerName: text("billing_customer_name"),
    billAddress: text("bill_address"),
    billCity: text("bill_city"),
    billState: text("bill_state"),
    billCountry: text("bill_country"),
    billZip: text("bill_zip"),
    billMobile: text("bill_mobile"),
    billEmail: text("bill_email"),
    // provenance
    source: text("source").default("upload").notNull(),
    syncBatchId: text("sync_batch_id"),
    /**
     * Stable identity of a line, hashed from its *immutable* descriptors only
     * (order id, sku, product, dimension, fabric, finish). Mutable fields —
     * quantity, payment, status, dispatch dates — are what an upsert writes on
     * conflict, so re-running a delta sync updates in place instead of
     * duplicating rows.
     */
    rowHash: text("row_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("ol_store_idx").on(t.storeId),
    index("ol_order_idx").on(t.orderId),
    index("ol_date_idx").on(t.orderDate),
    index("ol_state_idx").on(t.shipState),
    index("ol_city_idx").on(t.shipCity),
    index("ol_sales_idx").on(t.salesPerson),
    index("ol_ptype_idx").on(t.productType),
    index("ol_status_idx").on(t.status),
    // Every query in src/server/ filters by store first, then one of these.
    index("ol_store_date_idx").on(t.storeId, t.orderDate),
    index("ol_store_state_idx").on(t.storeId, t.shipState),
    index("ol_store_sales_idx").on(t.storeId, t.salesPerson),
    uniqueIndex("ol_store_rowhash_idx").on(t.storeId, t.rowHash),
  ],
);

/**
 * order_summary: rows from the lightweight "Order Summary" sheet.
 * An orderId present here but absent from order_lines => "Not Processed".
 */
export const orderSummary = pgTable(
  "order_summary",
  {
    id: serial("id").primaryKey(),
    storeId: text("store_id").notNull(),
    orderId: text("order_id").notNull(),
    orderDate: timestamp("order_date"),
    customerName: text("customer_name"),
    paymentAmount: doublePrecision("payment_amount").default(0).notNull(),
    salesPerson: text("sales_person"),
    source: text("source").default("sheets").notNull(),
  },
  (t) => [
    index("os_store_idx").on(t.storeId),
    index("os_order_idx").on(t.orderId),
  ],
);

/** Deduped customers (identity-matched by email / phone / both). */
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    storeId: text("store_id").notNull(),
    name: text("name"),
    email: text("email"),
    mobile: text("mobile"),
    identityKey: text("identity_key").notNull(),
    orderCount: integer("order_count").default(0).notNull(),
    unitsBought: integer("units_bought").default(0).notNull(),
    totalSpend: doublePrecision("total_spend").default(0).notNull(),
    firstOrderDate: timestamp("first_order_date"),
    lastOrderDate: timestamp("last_order_date"),
    isRepeat: boolean("is_repeat").default(false).notNull(),
  },
  (t) => [
    index("cust_store_idx").on(t.storeId),
    uniqueIndex("cust_identity_idx").on(t.storeId, t.identityKey),
  ],
);

/** Application users (login + role). */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("sales").notNull(), // 'admin' | 'sales'
  storeAccess: text("store_access").default("modern,homes,decor").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Configured data sources per store (Google Sheet URL or upload metadata). */
export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  storeId: text("store_id").notNull(),
  kind: text("kind").default("sheets").notNull(), // 'sheets' | 'upload'
  endpointUrl: text("endpoint_url"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastSyncMode: text("last_sync_mode"),
  rowCount: integer("row_count").default(0).notNull(),
});

/** Column-name mapping (source column -> canonical field), editable in Admin. */
export const schemaMappings = pgTable(
  "schema_mappings",
  {
    id: serial("id").primaryKey(),
    storeId: text("store_id").notNull(),
    canonicalField: text("canonical_field").notNull(),
    sourceColumn: text("source_column").notNull(),
  },
  (t) => [uniqueIndex("map_unique_idx").on(t.storeId, t.canonicalField)],
);

/** City -> lat/lng lookup for map bubbles. */
export const cityGeo = pgTable(
  "city_geo",
  {
    id: serial("id").primaryKey(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
  },
  (t) => [uniqueIndex("geo_unique_idx").on(t.city, t.state)],
);

/**
 * Pincode -> lat/lng lookup. Places orders at postal-code granularity (finer
 * than `city_geo`), so orders within a city scatter across their real pincodes
 * and the atlas can derive a meaningful order-concentration radius. Orders whose
 * `ship_zip` isn't a valid 6-digit pincode, or isn't in this table, fall back to
 * the city centroid in `city_geo`.
 */
export const pincodeGeo = pgTable("pincode_geo", {
  pincode: text("pincode").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
});

/** Generic key/value app settings (e.g. identity match mode). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type OrderLine = typeof orderLines.$inferSelect;
export type NewOrderLine = typeof orderLines.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type User = typeof users.$inferSelect;
