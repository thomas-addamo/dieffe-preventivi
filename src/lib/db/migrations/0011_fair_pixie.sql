ALTER TABLE "company_settings" ADD COLUMN "notify_team_on_accept" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "notify_team_on_reject" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "default_payment_terms" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "default_quote_notes" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "ai_enabled" boolean DEFAULT true NOT NULL;