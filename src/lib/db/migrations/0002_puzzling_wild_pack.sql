CREATE TABLE "quote_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" text NOT NULL,
	"signer_name" text NOT NULL,
	"signature_data_url" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "public_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "public_token_days" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "quote_signatures" ADD CONSTRAINT "quote_signatures_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_public_token_unique" UNIQUE("public_token");