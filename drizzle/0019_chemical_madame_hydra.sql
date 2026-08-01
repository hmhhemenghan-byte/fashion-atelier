CREATE TABLE `sample_signoff_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`sample_signoff_id` text NOT NULL,
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
	FOREIGN KEY (`sample_signoff_id`) REFERENCES `sample_signoffs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_signoff_checks_signoff_category_uidx` ON `sample_signoff_checks` (`sample_signoff_id`,`category`);--> statement-breakpoint
CREATE INDEX `sample_signoff_checks_signoff_sort_idx` ON `sample_signoff_checks` (`sample_signoff_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `sample_signoff_checks_result_idx` ON `sample_signoff_checks` (`result`);--> statement-breakpoint
CREATE TABLE `sample_signoff_images` (
	`id` text PRIMARY KEY NOT NULL,
	`sample_signoff_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`angle` text DEFAULT 'front' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`alt_text` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`sample_signoff_id`) REFERENCES `sample_signoffs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_signoff_images_image_key_unique` ON `sample_signoff_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `sample_signoff_images_signoff_sort_idx` ON `sample_signoff_images` (`sample_signoff_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `sample_signoff_images_signoff_status_idx` ON `sample_signoff_images` (`sample_signoff_id`,`status`);--> statement-breakpoint
CREATE TABLE `sample_signoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`signoff_code` text NOT NULL,
	`technical_pack_id` text NOT NULL,
	`fitting_session_id` text NOT NULL,
	`work_id` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`sample_type` text DEFAULT 'preproduction' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`sample_size` text DEFAULT '' NOT NULL,
	`maker_reference` text DEFAULT '' NOT NULL,
	`received_at` text,
	`reviewed_at` text,
	`physical_location` text DEFAULT '' NOT NULL,
	`material_lot_reference` text DEFAULT '' NOT NULL,
	`color_standard_reference` text DEFAULT '' NOT NULL,
	`overall_observation` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`seal_code` text,
	`sealed_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`technical_pack_id`) REFERENCES `technical_packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fitting_session_id`) REFERENCES `fitting_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_signoffs_signoff_code_unique` ON `sample_signoffs` (`signoff_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sample_signoffs_seal_code_unique` ON `sample_signoffs` (`seal_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sample_signoffs_pack_round_uidx` ON `sample_signoffs` (`technical_pack_id`,`round`);--> statement-breakpoint
CREATE INDEX `sample_signoffs_status_received_idx` ON `sample_signoffs` (`status`,`received_at`);--> statement-breakpoint
CREATE INDEX `sample_signoffs_work_updated_idx` ON `sample_signoffs` (`work_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_signoff_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_signoff_check_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_signoff_image_count` integer DEFAULT 0 NOT NULL;