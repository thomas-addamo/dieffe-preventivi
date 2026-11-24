ALTER TABLE "site_notes" ALTER COLUMN "site_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "site_logistics" smallint;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "site_logistics_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "site_logistics_by" text;--> statement-breakpoint
ALTER TABLE "site_notes" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_logistics_by_users_id_fk" FOREIGN KEY ("site_logistics_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_notes" ADD CONSTRAINT "site_notes_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_notes_quote_idx" ON "site_notes" USING btree ("quote_id","created_at");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_logistics_chk" CHECK ("quotes"."site_logistics" between 1 and 4);