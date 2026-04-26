CREATE TABLE `backlinks_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`target` text NOT NULL,
	`total_backlinks` integer DEFAULT 0 NOT NULL,
	`total_referring_domains` integer DEFAULT 0 NOT NULL,
	`rank` integer,
	`spam_score` real,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`top_domains_json` text DEFAULT '[]' NOT NULL,
	`top_anchors_json` text DEFAULT '[]' NOT NULL,
	`backlinks_sample_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `backlinks_analyses_project_created_idx` ON `backlinks_analyses` (`project_id`,`created_at`);