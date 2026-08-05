CREATE TABLE `production_acceptance_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`production_acceptance_id` text NOT NULL,
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
	FOREIGN KEY (`production_acceptance_id`) REFERENCES `production_acceptances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_acceptance_checks_acceptance_category_uidx` ON `production_acceptance_checks` (`production_acceptance_id`,`category`);--> statement-breakpoint
CREATE INDEX `production_acceptance_checks_acceptance_sort_idx` ON `production_acceptance_checks` (`production_acceptance_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `production_acceptance_checks_result_idx` ON `production_acceptance_checks` (`result`);--> statement-breakpoint
CREATE TABLE `production_acceptance_images` (
	`id` text PRIMARY KEY NOT NULL,
	`production_acceptance_id` text NOT NULL,
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
	FOREIGN KEY (`production_acceptance_id`) REFERENCES `production_acceptances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_acceptance_images_image_key_unique` ON `production_acceptance_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `production_acceptance_images_acceptance_sort_idx` ON `production_acceptance_images` (`production_acceptance_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `production_acceptance_images_acceptance_status_idx` ON `production_acceptance_images` (`production_acceptance_id`,`status`);--> statement-breakpoint
CREATE TABLE `production_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`acceptance_code` text NOT NULL,
	`production_release_id` text NOT NULL,
	`work_id` text NOT NULL,
	`sequence` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`edition_reference` text DEFAULT '' NOT NULL,
	`colorway` text DEFAULT '' NOT NULL,
	`size_range` text DEFAULT '' NOT NULL,
	`received_quantity` integer DEFAULT 0 NOT NULL,
	`inspected_quantity` integer DEFAULT 0 NOT NULL,
	`received_at` text,
	`inspected_at` text,
	`physical_location` text DEFAULT '' NOT NULL,
	`inspection_standard` text DEFAULT '' NOT NULL,
	`overall_observation` text DEFAULT '' NOT NULL,
	`disposition_note` text DEFAULT '' NOT NULL,
	`accepted_by` text DEFAULT '' NOT NULL,
	`accepted_at` text,
	`acceptance_seal` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`production_release_id`) REFERENCES `production_releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_acceptances_acceptance_code_unique` ON `production_acceptances` (`acceptance_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_acceptances_acceptance_seal_unique` ON `production_acceptances` (`acceptance_seal`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_acceptances_release_sequence_uidx` ON `production_acceptances` (`production_release_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `production_acceptances_work_status_idx` ON `production_acceptances` (`work_id`,`status`);--> statement-breakpoint
CREATE INDEX `production_acceptances_status_received_idx` ON `production_acceptances` (`status`,`received_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_acceptance_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_acceptance_check_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_acceptance_image_count` integer DEFAULT 0 NOT NULL;