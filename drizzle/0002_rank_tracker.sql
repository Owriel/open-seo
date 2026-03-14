-- Rank Tracker tables
CREATE TABLE IF NOT EXISTS `tracked_keywords` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `keyword` text NOT NULL,
  `domain` text NOT NULL,
  `location_code` integer NOT NULL DEFAULT 2724,
  `language_code` text NOT NULL DEFAULT 'es',
  `created_at` text NOT NULL DEFAULT (current_timestamp)
);

CREATE UNIQUE INDEX IF NOT EXISTS `tracked_keywords_unique` ON `tracked_keywords` (`project_id`, `keyword`, `domain`, `location_code`);
CREATE INDEX IF NOT EXISTS `tracked_keywords_project_idx` ON `tracked_keywords` (`project_id`);

CREATE TABLE IF NOT EXISTS `rank_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `tracked_keyword_id` text NOT NULL REFERENCES `tracked_keywords`(`id`) ON DELETE CASCADE,
  `position` integer,
  `url` text,
  `checked_at` text NOT NULL DEFAULT (current_timestamp)
);

CREATE INDEX IF NOT EXISTS `rank_history_keyword_idx` ON `rank_history` (`tracked_keyword_id`, `checked_at`);
