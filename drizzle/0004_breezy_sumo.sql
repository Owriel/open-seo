CREATE TABLE `local_grid_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`keyword` text NOT NULL,
	`target_domain` text NOT NULL,
	`center_lat` real NOT NULL,
	`center_lng` real NOT NULL,
	`grid_size` integer NOT NULL,
	`radius_km` real NOT NULL,
	`location_name` text,
	`language_code` text DEFAULT 'es' NOT NULL,
	`points_json` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `local_grid_scans_project_created_idx` ON `local_grid_scans` (`project_id`,`created_at`);