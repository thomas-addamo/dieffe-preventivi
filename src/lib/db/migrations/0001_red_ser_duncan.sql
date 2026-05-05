ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor';--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN "section_note" text;--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_sections" ADD COLUMN "is_optional_included" boolean DEFAULT false NOT NULL;