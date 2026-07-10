ALTER TABLE "order_lines" ADD COLUMN "row_hash" text;--> statement-breakpoint
CREATE INDEX "ol_store_date_idx" ON "order_lines" USING btree ("store_id","order_date");--> statement-breakpoint
CREATE INDEX "ol_store_state_idx" ON "order_lines" USING btree ("store_id","ship_state");--> statement-breakpoint
CREATE INDEX "ol_store_sales_idx" ON "order_lines" USING btree ("store_id","sales_person");--> statement-breakpoint
CREATE UNIQUE INDEX "ol_store_rowhash_idx" ON "order_lines" USING btree ("store_id","row_hash");