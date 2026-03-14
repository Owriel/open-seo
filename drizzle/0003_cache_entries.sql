-- Cache metadata table for tracking KV entries and managing expiration
CREATE TABLE `cache_entries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `kv_key` text NOT NULL,
  `label` text NOT NULL,
  `category` text NOT NULL DEFAULT 'general',
  `params_json` text,
  `created_at` text NOT NULL DEFAULT (current_timestamp),
  `expires_at` text NOT NULL,
  `extended_count` integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX `cache_entries_kv_key_idx` ON `cache_entries` (`kv_key`);
CREATE INDEX `cache_entries_expires_at_idx` ON `cache_entries` (`expires_at`);
CREATE INDEX `cache_entries_category_idx` ON `cache_entries` (`category`);
