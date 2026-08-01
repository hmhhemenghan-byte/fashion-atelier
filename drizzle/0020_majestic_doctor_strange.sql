CREATE TABLE `production_release_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`production_release_id` text NOT NULL,
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
	FOREIGN KEY (`production_release_id`) REFERENCES `production_releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_release_checks_release_category_uidx` ON `production_release_checks` (`production_release_id`,`category`);--> statement-breakpoint
CREATE INDEX `production_release_checks_release_sort_idx` ON `production_release_checks` (`production_release_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `production_release_checks_result_idx` ON `production_release_checks` (`result`);--> statement-breakpoint
CREATE TABLE `production_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`release_code` text NOT NULL,
	`sample_signoff_id` text NOT NULL,
	`technical_pack_id` text NOT NULL,
	`work_id` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`release_mode` text DEFAULT 'atelier' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`factory_name` text DEFAULT '' NOT NULL,
	`factory_reference` text DEFAULT '' NOT NULL,
	`size_range` text DEFAULT '' NOT NULL,
	`colorways` text DEFAULT '' NOT NULL,
	`planned_window_start` text,
	`planned_window_end` text,
	`quality_standard` text DEFAULT '' NOT NULL,
	`packaging_instruction` text DEFAULT '' NOT NULL,
	`release_summary` text DEFAULT '' NOT NULL,
	`open_risk` text DEFAULT '' NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`authorization_code` text,
	`released_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sample_signoff_id`) REFERENCES `sample_signoffs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`technical_pack_id`) REFERENCES `technical_packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_releases_release_code_unique` ON `production_releases` (`release_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_releases_authorization_code_unique` ON `production_releases` (`authorization_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_releases_signoff_sequence_uidx` ON `production_releases` (`sample_signoff_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `production_releases_status_window_idx` ON `production_releases` (`status`,`planned_window_start`);--> statement-breakpoint
CREATE INDEX `production_releases_work_updated_idx` ON `production_releases` (`work_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_release_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_release_check_count` integer DEFAULT 0 NOT NULL;