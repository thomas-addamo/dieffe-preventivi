CREATE TABLE IF NOT EXISTS "communications" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" jsonb NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"place" text,
	"document_date" text,
	"include_stamp" boolean DEFAULT true NOT NULL,
	"signatory" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communications" ADD CONSTRAINT "communications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communications_code_idx" ON "communications" USING btree ("code");