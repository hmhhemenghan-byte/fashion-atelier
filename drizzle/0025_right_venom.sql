CREATE TABLE `exhibition_readiness_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_readiness_plan_id` text NOT NULL,
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
	FOREIGN KEY (`exhibition_readiness_plan_id`) REFERENCES `exhibition_readiness_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_readiness_checks_plan_category_uidx` ON `exhibition_readiness_checks` (`exhibition_readiness_plan_id`,`category`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_checks_plan_sort_idx` ON `exhibition_readiness_checks` (`exhibition_readiness_plan_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_checks_result_idx` ON `exhibition_readiness_checks` (`result`);--> statement-breakpoint
CREATE TABLE `exhibition_readiness_images` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_readiness_plan_id` text NOT NULL,
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
	FOREIGN KEY (`exhibition_readiness_plan_id`) REFERENCES `exhibition_readiness_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_readiness_images_image_key_unique` ON `exhibition_readiness_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_images_plan_sort_idx` ON `exhibition_readiness_images` (`exhibition_readiness_plan_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_images_plan_status_idx` ON `exhibition_readiness_images` (`exhibition_readiness_plan_id`,`status`);--> statement-breakpoint
CREATE TABLE `exhibition_readiness_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_code` text NOT NULL,
	`sample_asset_id` text NOT NULL,
	`conservation_report_id` text NOT NULL,
	`work_id` text,
	`sequence` integer DEFAULT 1 NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT 'exhibition' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`install_at` text,
	`deinstall_at` text,
	`display_mode` text DEFAULT 'mannequin' NOT NULL,
	`mounting_method` text DEFAULT '' NOT NULL,
	`support_requirements` text DEFAULT '' NOT NULL,
	`dressing_instructions` text DEFAULT '' NOT NULL,
	`max_lux` integer DEFAULT 50 NOT NULL,
	`uv_limit` integer DEFAULT 75 NOT NULL,
	`rh_min` integer DEFAULT 45 NOT NULL,
	`rh_max` integer DEFAULT 55 NOT NULL,
	`temp_min` integer DEFAULT 18 NOT NULL,
	`temp_max` integer DEFAULT 21 NOT NULL,
	`max_display_days` integer DEFAULT 90 NOT NULL,
	`handling_team` text DEFAULT '' NOT NULL,
	`security_barrier` text DEFAULT '' NOT NULL,
	`emergency_instructions` text DEFAULT '' NOT NULL,
	`installation_notes` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_by` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`conservation_report_id`) REFERENCES `conservation_reports`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_readiness_plans_plan_code_unique` ON `exhibition_readiness_plans` (`plan_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_readiness_plans_asset_sequence_uidx` ON `exhibition_readiness_plans` (`sample_asset_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_plans_status_install_idx` ON `exhibition_readiness_plans` (`status`,`install_at`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_plans_deinstall_status_idx` ON `exhibition_readiness_plans` (`deinstall_at`,`status`);--> statement-breakpoint
CREATE INDEX `exhibition_readiness_plans_conservation_idx` ON `exhibition_readiness_plans` (`conservation_report_id`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_readiness_plan_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_readiness_check_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_readiness_image_count` integer DEFAULT 0 NOT NULL;