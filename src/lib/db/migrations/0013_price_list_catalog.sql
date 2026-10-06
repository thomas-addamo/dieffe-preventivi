ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "price_list_retention_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "price_list_maintained_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "price_list_maintenance_report" jsonb;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD COLUMN IF NOT EXISTS "subcategory" text;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD COLUMN IF NOT EXISTS "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_list_category_idx" ON "price_list_items" USING btree ("category","subcategory");--> statement-breakpoint
UPDATE "price_list_items" SET "source" = 'learned' WHERE "notes" LIKE 'Appreso automaticamente%';--> statement-breakpoint
UPDATE "price_list_items" SET "notes" = NULL WHERE "source" = 'learned' AND "notes" LIKE 'Appreso automaticamente%';
