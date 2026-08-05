CREATE TABLE `exhibition_recoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`recovery_code` text NOT NULL,
	`exhibition_watch_id` text NOT NULL,
	`sample_asset_id` text NOT NULL,
	`status` text DEFAULT 'intake' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`received_at` text,
	`handler` text DEFAULT '' NOT NULL,
	`intake_location` text DEFAULT '' NOT NULL,
	`packing_condition` text DEFAULT '' NOT NULL,
	`transit_condition` text DEFAULT '' NOT NULL,
	`unpacking_observation` text DEFAULT '' NOT NULL,
	`support_removal_note` text DEFAULT '' NOT NULL,
	`post_display_condition` text DEFAULT '' NOT NULL,
	`acclimatization_until` text,
	`treatment_required` integer DEFAULT false NOT NULL,
	`treatment_note` text DEFAULT '' NOT NULL,
	`storage_location` text DEFAULT '' NOT NULL,
	`recovery_note` text DEFAULT '' NOT NULL,
	`released_by` text DEFAULT '' NOT NULL,
	`released_at` text,
	`referred_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_watch_id`) REFERENCES `exhibition_watches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_recoveries_recovery_code_unique` ON `exhibition_recoveries` (`recovery_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_recoveries_exhibition_watch_id_unique` ON `exhibition_recoveries` (`exhibition_watch_id`);--> statement-breakpoint
CREATE INDEX `exhibition_recoveries_status_received_idx` ON `exhibition_recoveries` (`status`,`received_at`);--> statement-breakpoint
CREATE INDEX `exhibition_recoveries_asset_idx` ON `exhibition_recoveries` (`sample_asset_id`);--> statement-breakpoint
CREATE INDEX `exhibition_recoveries_stabilization_idx` ON `exhibition_recoveries` (`status`,`acclimatization_until`);--> statement-breakpoint
CREATE TABLE `exhibition_recovery_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_recovery_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`requirement` text DEFAULT '' NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`critical` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_recovery_id`) REFERENCES `exhibition_recoveries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_recovery_checks_recovery_category_uidx` ON `exhibition_recovery_checks` (`exhibition_recovery_id`,`category`);--> statement-breakpoint
CREATE INDEX `exhibition_recovery_checks_recovery_sort_idx` ON `exhibition_recovery_checks` (`exhibition_recovery_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `exhibition_recovery_checks_result_idx` ON `exhibition_recovery_checks` (`result`);--> statement-breakpoint
CREATE TABLE `exhibition_recovery_images` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_recovery_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`angle` text DEFAULT 'intake' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`alt_text` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_recovery_id`) REFERENCES `exhibition_recoveries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_recovery_images_image_key_unique` ON `exhibition_recovery_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `exhibition_recovery_images_recovery_sort_idx` ON `exhibition_recovery_images` (`exhibition_recovery_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `exhibition_recovery_images_recovery_status_idx` ON `exhibition_recovery_images` (`exhibition_recovery_id`,`status`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_recovery_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_recovery_check_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_recovery_image_count` integer DEFAULT 0 NOT NULL;