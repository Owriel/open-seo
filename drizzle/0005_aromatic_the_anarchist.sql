CREATE TABLE `review_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`keyword` text NOT NULL,
	`place_id` text,
	`business_name` text,
	`location_name` text,
	`language_code` text DEFAULT 'es' NOT NULL,
	`total_reviews` integer DEFAULT 0 NOT NULL,
	`avg_rating` real,
	`rating_distribution_json` text DEFAULT '[0,0,0,0,0]' NOT NULL,
	`reviews_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_analyses_project_created_idx` ON `review_analyses` (`project_id`,`created_at`);