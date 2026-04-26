ALTER TABLE `projects` ADD `target_keyword` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `location_name` text DEFAULT 'Spain';--> statement-breakpoint
ALTER TABLE `projects` ADD `language_code` text DEFAULT 'es';--> statement-breakpoint
ALTER TABLE `projects` ADD `place_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `business_name` text;--> statement-breakpoint
ALTER TABLE `audit_pages` DROP COLUMN `schema_types_json`;