CREATE TABLE `conservation_report_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`conservation_report_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`requirement` text DEFAULT '' NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`severity` text DEFAULT 'none' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`treatment_note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conservation_report_id`) REFERENCES `conservation_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conservation_report_checks_report_category_uidx` ON `conservation_report_checks` (`conservation_report_id`,`category`);--> statement-breakpoint
CREATE INDEX `conservation_report_checks_report_sort_idx` ON `conservation_report_checks` (`conservation_report_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `conservation_report_checks_result_severity_idx` ON `conservation_report_checks` (`result`,`severity`);--> statement-breakpoint
CREATE TABLE `conservation_report_images` (
	`id` text PRIMARY KEY NOT NULL,
	`conservation_report_id` text NOT NULL,
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
	FOREIGN KEY (`conservation_report_id`) REFERENCES `conservation_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conservation_report_images_image_key_unique` ON `conservation_report_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `conservation_report_images_report_sort_idx` ON `conservation_report_images` (`conservation_report_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `conservation_report_images_report_status_idx` ON `conservation_report_images` (`conservation_report_id`,`status`);--> statement-breakpoint
CREATE TABLE `conservation_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`report_code` text NOT NULL,
	`sample_asset_id` text NOT NULL,
	`work_id` text,
	`sequence` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`assessed_at` text,
	`assessment_location` text DEFAULT '' NOT NULL,
	`overall_condition` text DEFAULT 'not_checked' NOT NULL,
	`condition_summary` text DEFAULT '' NOT NULL,
	`proposed_treatment` text DEFAULT '' NOT NULL,
	`handling_restriction` text DEFAULT '' NOT NULL,
	`storage_guidance` text DEFAULT '' NOT NULL,
	`environmental_notes` text DEFAULT '' NOT NULL,
	`next_review_at` text,
	`treatment_completed_at` text,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_by` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conservation_reports_report_code_unique` ON `conservation_reports` (`report_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `conservation_reports_asset_sequence_uidx` ON `conservation_reports` (`sample_asset_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `conservation_reports_asset_status_idx` ON `conservation_reports` (`sample_asset_id`,`status`);--> statement-breakpoint
CREATE INDEX `conservation_reports_review_status_idx` ON `conservation_reports` (`next_review_at`,`status`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `conservation_report_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `conservation_report_check_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `conservation_report_image_count` integer DEFAULT 0 NOT NULL;