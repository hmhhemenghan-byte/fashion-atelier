CREATE TABLE `exhibition_delivery_items` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_delivery_package_id` text NOT NULL,
	`source_type` text DEFAULT 'entrance' NOT NULL,
	`source_id` text NOT NULL,
	`language` text DEFAULT 'zh-CN' NOT NULL,
	`channel` text DEFAULT 'wall_text' NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`placement` text DEFAULT '' NOT NULL,
	`format_spec` text DEFAULT '' NOT NULL,
	`proof_status` text DEFAULT 'draft' NOT NULL,
	`proof_note` text DEFAULT '' NOT NULL,
	`handoff_note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_delivery_package_id`) REFERENCES `exhibition_delivery_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_delivery_items_source_language_uidx` ON `exhibition_delivery_items` (`exhibition_delivery_package_id`,`source_type`,`source_id`,`language`);--> statement-breakpoint
CREATE INDEX `exhibition_delivery_items_package_sequence_idx` ON `exhibition_delivery_items` (`exhibition_delivery_package_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `exhibition_delivery_items_proof_status_idx` ON `exhibition_delivery_items` (`proof_status`);--> statement-breakpoint
CREATE TABLE `exhibition_delivery_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_code` text NOT NULL,
	`interpretation_package_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`delivery_at` text,
	`master_title` text DEFAULT '' NOT NULL,
	`format_standard` text DEFAULT '' NOT NULL,
	`placement_standard` text DEFAULT '' NOT NULL,
	`accessibility_standard` text DEFAULT '' NOT NULL,
	`rights_standard` text DEFAULT '' NOT NULL,
	`handoff_note` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`interpretation_package_id`) REFERENCES `interpretation_packages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_delivery_packages_delivery_code_unique` ON `exhibition_delivery_packages` (`delivery_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_delivery_packages_interpretation_revision_uidx` ON `exhibition_delivery_packages` (`interpretation_package_id`,`revision`);--> statement-breakpoint
CREATE INDEX `exhibition_delivery_packages_status_delivery_idx` ON `exhibition_delivery_packages` (`status`,`delivery_at`);--> statement-breakpoint
CREATE INDEX `exhibition_delivery_packages_updated_at_idx` ON `exhibition_delivery_packages` (`updated_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_delivery_package_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_delivery_item_count` integer DEFAULT 0 NOT NULL;