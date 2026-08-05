CREATE TABLE `interpretation_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`interpretation_package_id` text NOT NULL,
	`curatorial_selection_id` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`body_primary` text DEFAULT '' NOT NULL,
	`body_secondary` text DEFAULT '' NOT NULL,
	`object_facts` text DEFAULT '' NOT NULL,
	`credit_line` text DEFAULT '' NOT NULL,
	`accessibility_text` text DEFAULT '' NOT NULL,
	`source_note` text DEFAULT '' NOT NULL,
	`rights_status` text DEFAULT 'unchecked' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`interpretation_package_id`) REFERENCES `interpretation_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`curatorial_selection_id`) REFERENCES `curatorial_selections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interpretation_labels_package_selection_uidx` ON `interpretation_labels` (`interpretation_package_id`,`curatorial_selection_id`);--> statement-breakpoint
CREATE INDEX `interpretation_labels_package_sequence_idx` ON `interpretation_labels` (`interpretation_package_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `interpretation_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`package_code` text NOT NULL,
	`curatorial_project_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`editor` text DEFAULT '' NOT NULL,
	`primary_language` text DEFAULT 'zh-CN' NOT NULL,
	`secondary_language` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`entrance_text` text DEFAULT '' NOT NULL,
	`curatorial_credit` text DEFAULT '' NOT NULL,
	`acknowledgement` text DEFAULT '' NOT NULL,
	`accessibility_note` text DEFAULT '' NOT NULL,
	`rights_note` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`curatorial_project_id`) REFERENCES `curatorial_projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interpretation_packages_package_code_unique` ON `interpretation_packages` (`package_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `interpretation_packages_project_revision_uidx` ON `interpretation_packages` (`curatorial_project_id`,`revision`);--> statement-breakpoint
CREATE INDEX `interpretation_packages_status_updated_idx` ON `interpretation_packages` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `interpretation_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`interpretation_package_id` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`title_primary` text DEFAULT '' NOT NULL,
	`title_secondary` text DEFAULT '' NOT NULL,
	`body_primary` text DEFAULT '' NOT NULL,
	`body_secondary` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`interpretation_package_id`) REFERENCES `interpretation_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interpretation_sections_package_sequence_idx` ON `interpretation_sections` (`interpretation_package_id`,`sequence`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `interpretation_package_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `interpretation_section_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `interpretation_label_count` integer DEFAULT 0 NOT NULL;