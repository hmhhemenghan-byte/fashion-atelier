CREATE TABLE `provenance_dossier_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`provenance_dossier_id` text NOT NULL,
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
	FOREIGN KEY (`provenance_dossier_id`) REFERENCES `provenance_dossiers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provenance_dossier_checks_dossier_category_uidx` ON `provenance_dossier_checks` (`provenance_dossier_id`,`category`);--> statement-breakpoint
CREATE INDEX `provenance_dossier_checks_dossier_sort_idx` ON `provenance_dossier_checks` (`provenance_dossier_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `provenance_dossier_checks_result_idx` ON `provenance_dossier_checks` (`result`);--> statement-breakpoint
CREATE TABLE `provenance_dossiers` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_code` text NOT NULL,
	`slug` text NOT NULL,
	`production_acceptance_id` text NOT NULL,
	`work_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`design_story` text DEFAULT '' NOT NULL,
	`material_disclosure` text DEFAULT '' NOT NULL,
	`maker_disclosure` text DEFAULT '' NOT NULL,
	`place_of_making` text DEFAULT '' NOT NULL,
	`made_at` text,
	`care_guidance` text DEFAULT '' NOT NULL,
	`repair_guidance` text DEFAULT '' NOT NULL,
	`provenance_note` text DEFAULT '' NOT NULL,
	`public_summary` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`published_by` text DEFAULT '' NOT NULL,
	`published_at` text,
	`retired_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`production_acceptance_id`) REFERENCES `production_acceptances`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provenance_dossiers_dossier_code_unique` ON `provenance_dossiers` (`dossier_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `provenance_dossiers_slug_unique` ON `provenance_dossiers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `provenance_dossiers_acceptance_revision_uidx` ON `provenance_dossiers` (`production_acceptance_id`,`revision`);--> statement-breakpoint
CREATE INDEX `provenance_dossiers_work_status_idx` ON `provenance_dossiers` (`work_id`,`status`);--> statement-breakpoint
CREATE INDEX `provenance_dossiers_status_published_idx` ON `provenance_dossiers` (`status`,`published_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `provenance_dossier_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `provenance_dossier_check_count` integer DEFAULT 0 NOT NULL;