CREATE TABLE `curatorial_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`project_code` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`curator` text DEFAULT '' NOT NULL,
	`venue_context` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`opening_at` text,
	`closing_at` text,
	`thesis` text DEFAULT '' NOT NULL,
	`narrative` text DEFAULT '' NOT NULL,
	`spatial_note` text DEFAULT '' NOT NULL,
	`selection_note` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `curatorial_projects_project_code_unique` ON `curatorial_projects` (`project_code`);--> statement-breakpoint
CREATE INDEX `curatorial_projects_status_opening_idx` ON `curatorial_projects` (`status`,`opening_at`);--> statement-breakpoint
CREATE INDEX `curatorial_projects_updated_at_idx` ON `curatorial_projects` (`updated_at`);--> statement-breakpoint
CREATE TABLE `curatorial_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`curatorial_project_id` text NOT NULL,
	`sample_asset_id` text NOT NULL,
	`decision` text DEFAULT 'proposed' NOT NULL,
	`role` text DEFAULT 'dialogue' NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`display_intent` text DEFAULT '' NOT NULL,
	`conservation_note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`curatorial_project_id`) REFERENCES `curatorial_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sample_asset_id`) REFERENCES `sample_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `curatorial_selections_project_asset_uidx` ON `curatorial_selections` (`curatorial_project_id`,`sample_asset_id`);--> statement-breakpoint
CREATE INDEX `curatorial_selections_project_sequence_idx` ON `curatorial_selections` (`curatorial_project_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `curatorial_selections_asset_decision_idx` ON `curatorial_selections` (`sample_asset_id`,`decision`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `curatorial_project_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `curatorial_selection_count` integer DEFAULT 0 NOT NULL;