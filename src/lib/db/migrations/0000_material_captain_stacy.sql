CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`changes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`vat_number` text,
	`email` text,
	`phone` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`logo_path` text,
	`address` text,
	`vat_number` text,
	`email` text,
	`phone` text,
	`website` text,
	`default_vat_rate` real DEFAULT 22 NOT NULL,
	`default_export_path` text,
	`pdf_template` text DEFAULT 'classic' NOT NULL,
	`primary_color` text DEFAULT '#1e40af' NOT NULL,
	`accent_color` text DEFAULT '#059669' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_item_images` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`filename` text NOT NULL,
	`path` text NOT NULL,
	`caption` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `quote_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`unit_of_measure` text DEFAULT 'n°' NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`notes` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `quote_sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_items_section_id_idx` ON `quote_items` (`section_id`);--> statement-breakpoint
CREATE TABLE `quote_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_sections_quote_id_idx` ON `quote_sections` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`data` text NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `quote_year_counters` (
	`year` integer PRIMARY KEY NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`client_id` text,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`project_address` text,
	`vat_rate` real DEFAULT 22 NOT NULL,
	`discount_type` text,
	`discount_value` real,
	`notes` text,
	`payment_terms` text,
	`valid_until` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_code_idx` ON `quotes` (`code`);--> statement-breakpoint
CREATE INDEX `quotes_user_id_idx` ON `quotes` (`user_id`);--> statement-breakpoint
CREATE INDEX `quotes_client_id_idx` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);