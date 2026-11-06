CREATE TABLE "site_events" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"date" date NOT NULL,
	"end_date" date,
	"type" text DEFAULT 'altro' NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"quote_id" text,
	"label" text NOT NULL,
	"percent" double precision,
	"amount" double precision,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"phase_id" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"reached_at" timestamp with time zone,
	"invoiced_at" timestamp with time zone,
	"invoice_number" text,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "site_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"body" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_phases" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"quote_id" text,
	"title" text NOT NULL,
	"weight" double precision DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"duration_days" integer,
	"planned_start" date,
	"planned_end" date,
	"done_at" timestamp with time zone,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"main_quote_id" text NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"geo_status" text DEFAULT 'pending' NOT NULL,
	"start_date" date,
	"planned_end_date" date,
	"daily_cost" double precision,
	"penalty_per_day" double precision,
	"margin_pct" double precision DEFAULT 20 NOT NULL,
	"progress" double precision DEFAULT 0 NOT NULL,
	"ai_insights" jsonb,
	"ai_insights_hash" text,
	"ai_insights_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "site_setup_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "works_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_milestones" ADD CONSTRAINT "site_milestones_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_milestones" ADD CONSTRAINT "site_milestones_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_milestones" ADD CONSTRAINT "site_milestones_phase_id_site_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."site_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_notes" ADD CONSTRAINT "site_notes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_notes" ADD CONSTRAINT "site_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_phases" ADD CONSTRAINT "site_phases_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_phases" ADD CONSTRAINT "site_phases_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_main_quote_id_quotes_id_fk" FOREIGN KEY ("main_quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_events_site_date_idx" ON "site_events" USING btree ("site_id","date");--> statement-breakpoint
CREATE INDEX "site_milestones_site_idx" ON "site_milestones" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_notes_site_idx" ON "site_notes" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_phases_site_idx" ON "site_phases" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_main_quote_idx" ON "sites" USING btree ("main_quote_id");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_site_id_idx" ON "quotes" USING btree ("site_id");