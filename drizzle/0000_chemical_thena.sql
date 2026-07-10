CREATE TABLE "city_geo" (
	"id" serial PRIMARY KEY NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"name" text,
	"email" text,
	"mobile" text,
	"identity_key" text NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"units_bought" integer DEFAULT 0 NOT NULL,
	"total_spend" double precision DEFAULT 0 NOT NULL,
	"first_order_date" timestamp,
	"last_order_date" timestamp,
	"is_repeat" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"kind" text DEFAULT 'sheets' NOT NULL,
	"endpoint_url" text,
	"last_synced_at" timestamp,
	"last_sync_mode" text,
	"row_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"order_id" text NOT NULL,
	"invoice_no" text,
	"order_date" timestamp,
	"product_name" text,
	"product_category" text,
	"product_type" text,
	"sku" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"payment_amount" double precision DEFAULT 0 NOT NULL,
	"status" text,
	"ship_city" text,
	"ship_state" text,
	"ship_country" text,
	"ship_customer_name" text,
	"ship_email" text,
	"ship_mobile" text,
	"ship_address" text,
	"ship_zip" text,
	"sales_person" text,
	"image_url" text,
	"fabric" text,
	"dimension" text,
	"polish_finish" text,
	"committed_delivery_date" timestamp,
	"dispatched_date" timestamp,
	"extended_date" timestamp,
	"tracking_number" text,
	"remarks" text,
	"payment_type" text,
	"billing_customer_name" text,
	"bill_address" text,
	"bill_city" text,
	"bill_state" text,
	"bill_country" text,
	"bill_zip" text,
	"bill_mobile" text,
	"bill_email" text,
	"source" text DEFAULT 'upload' NOT NULL,
	"sync_batch_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"order_id" text NOT NULL,
	"order_date" timestamp,
	"customer_name" text,
	"payment_amount" double precision DEFAULT 0 NOT NULL,
	"sales_person" text,
	"source" text DEFAULT 'sheets' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"canonical_field" text NOT NULL,
	"source_column" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'sales' NOT NULL,
	"store_access" text DEFAULT 'modern,homes,decor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "geo_unique_idx" ON "city_geo" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX "cust_store_idx" ON "customers" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cust_identity_idx" ON "customers" USING btree ("store_id","identity_key");--> statement-breakpoint
CREATE INDEX "ol_store_idx" ON "order_lines" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ol_order_idx" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ol_date_idx" ON "order_lines" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "ol_state_idx" ON "order_lines" USING btree ("ship_state");--> statement-breakpoint
CREATE INDEX "ol_city_idx" ON "order_lines" USING btree ("ship_city");--> statement-breakpoint
CREATE INDEX "ol_sales_idx" ON "order_lines" USING btree ("sales_person");--> statement-breakpoint
CREATE INDEX "ol_ptype_idx" ON "order_lines" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "ol_status_idx" ON "order_lines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "os_store_idx" ON "order_summary" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "os_order_idx" ON "order_summary" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "map_unique_idx" ON "schema_mappings" USING btree ("store_id","canonical_field");