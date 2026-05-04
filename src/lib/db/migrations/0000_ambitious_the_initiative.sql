CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"vat_number" text,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"logo_path" text,
	"address" text,
	"vat_number" text,
	"email" text,
	"phone" text,
	"website" text,
	"default_vat_rate" double precision DEFAULT 22 NOT NULL,
	"default_export_path" text,
	"pdf_template" text DEFAULT 'classic' NOT NULL,
	"primary_color" text DEFAULT '#1e40af' NOT NULL,
	"accent_color" text DEFAULT '#059669' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_item_images" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"cloudinary_url" text NOT NULL,
	"caption" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"unit_of_measure" text DEFAULT 'n°' NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"data" jsonb NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_year_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"client_id" text,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"project_address" text,
	"vat_rate" double precision DEFAULT 22 NOT NULL,
	"discount_type" text,
	"discount_value" double precision,
	"notes" text,
	"payment_terms" text,
	"valid_until" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item_images" ADD CONSTRAINT "quote_item_images_item_id_quote_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."quote_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_section_id_quote_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."quote_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_sections" ADD CONSTRAINT "quote_sections_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_items_section_id_idx" ON "quote_items" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "quote_sections_quote_id_idx" ON "quote_sections" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_code_idx" ON "quotes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "quotes_user_id_idx" ON "quotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quotes_client_id_idx" ON "quotes" USING btree ("client_id");