CREATE TABLE "site_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"public_id" text NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"bytes" integer,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "lock_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "lock_override_by" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "unlock_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "unlock_requested_by" text;--> statement-breakpoint
ALTER TABLE "site_documents" ADD CONSTRAINT "site_documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_documents" ADD CONSTRAINT "site_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_documents_site_idx" ON "site_documents" USING btree ("site_id","created_at");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lock_override_by_users_id_fk" FOREIGN KEY ("lock_override_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_unlock_requested_by_users_id_fk" FOREIGN KEY ("unlock_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;