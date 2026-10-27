CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"sku" text NOT NULL,
	"sku_key" text NOT NULL,
	"name" text,
	"name_key" text,
	"created_at" timestamp,
	"product_type" text,
	"visibility" text,
	"categories" text
);
--> statement-breakpoint
CREATE INDEX "prod_store_idx" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "prod_store_namekey_idx" ON "products" USING btree ("store_id","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "prod_store_skukey_idx" ON "products" USING btree ("store_id","sku_key");