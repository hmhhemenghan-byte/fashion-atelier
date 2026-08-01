CREATE TABLE `sample_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text,
	`work_title` text NOT NULL,
	`look_number` text DEFAULT '' NOT NULL,
	`image_key` text DEFAULT '' NOT NULL,
	`asset_code` text NOT NULL,
	`tag_code` text,
	`size_label` text DEFAULT '' NOT NULL,
	`color_label` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'garment' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`condition` text DEFAULT 'not_checked' NOT NULL,
	`department` text DEFAULT 'SHOWROOM' NOT NULL,
	`home_location` text DEFAULT 'MAIN RACK' NOT NULL,
	`current_location` text DEFAULT 'MAIN RACK' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_seen_at` text,
	`last_audit_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_assets_asset_code_unique` ON `sample_assets` (`asset_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sample_assets_tag_code_unique` ON `sample_assets` (`tag_code`);--> statement-breakpoint
CREATE INDEX `sample_assets_work_idx` ON `sample_assets` (`work_id`);--> statement-breakpoint
CREATE INDEX `sample_assets_status_location_idx` ON `sample_assets` (`status`,`current_location`);--> statement-breakpoint
CREATE INDEX `sample_assets_department_idx` ON `sample_assets` (`department`);--> statement-breakpoint
CREATE INDEX `sample_assets_updated_at_idx` ON `sample_assets` (`updated_at`);--> statement-breakpoint
CREATE TABLE `sample_audit_items` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`sample_asset_id` text,
	`asset_code` text NOT NULL,
	`work_title` text DEFAULT '' NOT NULL,
	`expected_status` text DEFAULT '' NOT NULL,
	`expected_location` text DEFAULT '' NOT NULL,
	`observed_location` text DEFAULT '' NOT NULL,
	`observed_condition` text DEFAULT 'not_checked' NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`scanned_at` text,
	`resolved_at` text,
	`resolution_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `sample_audits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_audit_items_audit_asset_uidx` ON `sample_audit_items` (`audit_id`,`sample_asset_id`);--> statement-breakpoint
CREATE INDEX `sample_audit_items_audit_result_idx` ON `sample_audit_items` (`audit_id`,`result`);--> statement-breakpoint
CREATE TABLE `sample_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_code` text NOT NULL,
	`label` text NOT NULL,
	`scope_location` text DEFAULT '' NOT NULL,
	`scope_department` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'counting' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_audits_audit_code_unique` ON `sample_audits` (`audit_code`);--> statement-breakpoint
CREATE INDEX `sample_audits_status_started_idx` ON `sample_audits` (`status`,`started_at`);--> statement-breakpoint
CREATE INDEX `sample_audits_created_at_idx` ON `sample_audits` (`created_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_asset_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_audit_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_audit_item_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sample_loan_items` ADD `sample_asset_id` text REFERENCES sample_assets(id);--> statement-breakpoint
CREATE INDEX `sample_loan_items_asset_idx` ON `sample_loan_items` (`sample_asset_id`);