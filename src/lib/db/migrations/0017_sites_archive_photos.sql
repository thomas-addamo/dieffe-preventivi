CREATE TABLE "site_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"phase_id" text,
	"public_id" text NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_notes" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "archive_reason" text;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_phase_id_site_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."site_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_photos_site_idx" ON "site_photos" USING btree ("site_id","created_at");