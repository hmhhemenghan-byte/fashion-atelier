CREATE TABLE `exhibition_watch_images` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_watch_id` text NOT NULL,
	`observation_id` text,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`angle` text DEFAULT 'overall' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`alt_text` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_watch_id`) REFERENCES `exhibition_watches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`observation_id`) REFERENCES `exhibition_watch_observations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_watch_images_image_key_unique` ON `exhibition_watch_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `exhibition_watch_images_watch_sort_idx` ON `exhibition_watch_images` (`exhibition_watch_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `exhibition_watch_images_observation_idx` ON `exhibition_watch_images` (`observation_id`);--> statement-breakpoint
CREATE TABLE `exhibition_watch_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_watch_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`lux` integer,
	`uv` integer,
	`rh` integer,
	`temperature_tenth` integer,
	`condition_result` text DEFAULT 'stable' NOT NULL,
	`support_result` text DEFAULT 'stable' NOT NULL,
	`pest_result` text DEFAULT 'none' NOT NULL,
	`incident_type` text DEFAULT 'none' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`action_taken` text DEFAULT '' NOT NULL,
	`disposition` text DEFAULT 'continue' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_watch_id`) REFERENCES `exhibition_watches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exhibition_watch_observations_watch_time_idx` ON `exhibition_watch_observations` (`exhibition_watch_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `exhibition_watch_observations_incident_idx` ON `exhibition_watch_observations` (`incident_type`,`condition_result`);--> statement-breakpoint
CREATE TABLE `exhibition_watches` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_code` text NOT NULL,
	`exhibition_readiness_plan_id` text NOT NULL,
	`sample_asset_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`monitoring_interval_hours` integer DEFAULT 24 NOT NULL,
	`steward` text DEFAULT '' NOT NULL,
	`opening_condition` text DEFAULT '' NOT NULL,
	`decision_note` text DEFAULT '' NOT NULL,
	`deinstallation_condition` text DEFAULT '' NOT NULL,
	`return_location` text DEFAULT '' NOT NULL,
	`opened_at` text NOT NULL,
	`last_observed_at` text,
	`deinstalled_at` text,
	`closed_by` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_readiness_plan_id`) REFERENCES `exhibition_readiness_plans`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_watches_watch_code_unique` ON `exhibition_watches` (`watch_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_watches_exhibition_readiness_plan_id_unique` ON `exhibition_watches` (`exhibition_readiness_plan_id`);--> statement-breakpoint
CREATE INDEX `exhibition_watches_status_observed_idx` ON `exhibition_watches` (`status`,`last_observed_at`);--> statement-breakpoint
CREATE INDEX `exhibition_watches_asset_idx` ON `exhibition_watches` (`sample_asset_id`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_watch_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_watch_observation_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_watch_image_count` integer DEFAULT 0 NOT NULL;