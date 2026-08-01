CREATE TABLE `sample_placement_items` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_id` text NOT NULL,
	`sample_loan_item_id` text,
	`sample_asset_id` text,
	`work_id` text,
	`asset_code` text DEFAULT '' NOT NULL,
	`work_title` text NOT NULL,
	`look_number` text DEFAULT '' NOT NULL,
	`image_key` text DEFAULT '' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`credit_text` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `sample_placements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sample_loan_item_id`) REFERENCES `sample_loan_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_placement_items_placement_loan_item_uidx` ON `sample_placement_items` (`placement_id`,`sample_loan_item_id`);--> statement-breakpoint
CREATE INDEX `sample_placement_items_placement_sort_idx` ON `sample_placement_items` (`placement_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `sample_placement_items_asset_idx` ON `sample_placement_items` (`sample_asset_id`);--> statement-breakpoint
CREATE INDEX `sample_placement_items_work_idx` ON `sample_placement_items` (`work_id`);--> statement-breakpoint
CREATE TABLE `sample_placements` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_code` text NOT NULL,
	`loan_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`placement_type` text DEFAULT 'editorial' NOT NULL,
	`channel` text DEFAULT 'print' NOT NULL,
	`title` text NOT NULL,
	`outlet_name` text DEFAULT '' NOT NULL,
	`voice_name` text DEFAULT '' NOT NULL,
	`voice_type` text DEFAULT 'media' NOT NULL,
	`event_name` text DEFAULT '' NOT NULL,
	`market` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`placement_date` text,
	`source_url` text DEFAULT '' NOT NULL,
	`evidence_image_key` text DEFAULT '' NOT NULL,
	`evidence_image_type` text DEFAULT '' NOT NULL,
	`evidence_image_size` integer DEFAULT 0 NOT NULL,
	`evidence_alt_text` text DEFAULT '' NOT NULL,
	`reported_reach` integer,
	`reported_engagements` integer,
	`reported_impact_cents` integer,
	`impact_currency` text DEFAULT 'USD' NOT NULL,
	`metric_mode` text DEFAULT 'not_recorded' NOT NULL,
	`metric_source` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `sample_loans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_placements_placement_code_unique` ON `sample_placements` (`placement_code`);--> statement-breakpoint
CREATE INDEX `sample_placements_status_date_idx` ON `sample_placements` (`status`,`placement_date`);--> statement-breakpoint
CREATE INDEX `sample_placements_loan_idx` ON `sample_placements` (`loan_id`);--> statement-breakpoint
CREATE INDEX `sample_placements_channel_voice_idx` ON `sample_placements` (`channel`,`voice_type`);--> statement-breakpoint
CREATE INDEX `sample_placements_updated_at_idx` ON `sample_placements` (`updated_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_placement_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_placement_item_count` integer DEFAULT 0 NOT NULL;