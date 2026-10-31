ALTER TABLE "products" ADD COLUMN "new_month" text;--> statement-breakpoint
CREATE INDEX "prod_store_newmonth_idx" ON "products" USING btree ("store_id","new_month");