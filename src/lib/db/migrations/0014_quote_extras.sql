ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "parent_quote_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_quote_id_quotes_id_fk" FOREIGN KEY ("parent_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_parent_id_idx" ON "quotes" USING btree ("parent_quote_id");
