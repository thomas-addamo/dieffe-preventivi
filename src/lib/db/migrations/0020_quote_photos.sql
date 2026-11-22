ALTER TABLE "site_photos" ALTER COLUMN "site_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "site_photos" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_photos_quote_idx" ON "site_photos" USING btree ("quote_id","created_at");