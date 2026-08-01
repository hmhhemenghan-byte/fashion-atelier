CREATE TABLE `tech_pack_construction_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tech_pack_id` text NOT NULL,
	`category` text DEFAULT 'seam' NOT NULL,
	`title` text NOT NULL,
	`instruction` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'standard' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tech_pack_id`) REFERENCES `technical_packs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tech_pack_notes_pack_sort_idx` ON `tech_pack_construction_notes` (`tech_pack_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tech_pack_notes_pack_status_idx` ON `tech_pack_construction_notes` (`tech_pack_id`,`status`);--> statement-breakpoint
CREATE TABLE `tech_pack_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`tech_pack_id` text NOT NULL,
	`point_code` text DEFAULT '' NOT NULL,
	`label` text NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`tolerance_plus` text DEFAULT '' NOT NULL,
	`tolerance_minus` text DEFAULT '' NOT NULL,
	`method` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tech_pack_id`) REFERENCES `technical_packs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tech_pack_measurements_pack_sort_idx` ON `tech_pack_measurements` (`tech_pack_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `tech_pack_measurements_pack_status_idx` ON `tech_pack_measurements` (`tech_pack_id`,`status`);--> statement-breakpoint
CREATE TABLE `technical_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`tech_pack_code` text NOT NULL,
	`work_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sample_stage` text DEFAULT 'concept' NOT NULL,
	`base_size` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'cm' NOT NULL,
	`fit_intent` text DEFAULT '' NOT NULL,
	`pattern_reference` text DEFAULT '' NOT NULL,
	`construction_summary` text DEFAULT '' NOT NULL,
	`grading_notes` text DEFAULT '' NOT NULL,
	`finishing_notes` text DEFAULT '' NOT NULL,
	`label_notes` text DEFAULT '' NOT NULL,
	`packaging_notes` text DEFAULT '' NOT NULL,
	`sketch_image_key` text,
	`sketch_image_type` text,
	`sketch_image_size` integer,
	`sketch_alt_text` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `technical_packs_tech_pack_code_unique` ON `technical_packs` (`tech_pack_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `technical_packs_sketch_image_key_unique` ON `technical_packs` (`sketch_image_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `technical_packs_work_revision_uidx` ON `technical_packs` (`work_id`,`revision`);--> statement-breakpoint
CREATE INDEX `technical_packs_status_stage_idx` ON `technical_packs` (`status`,`sample_stage`);--> statement-breakpoint
CREATE INDEX `technical_packs_work_updated_idx` ON `technical_packs` (`work_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `technical_pack_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `tech_pack_measurement_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `tech_pack_construction_note_count` integer DEFAULT 0 NOT NULL;