ALTER TABLE "company_settings" ADD COLUMN "email_from_address" text DEFAULT 'onboarding@resend.dev';--> statement-breakpoint
ALTER TABLE "quote_signatures" ADD COLUMN "signer_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_signatures" ADD COLUMN "ip_consent" boolean DEFAULT false NOT NULL;