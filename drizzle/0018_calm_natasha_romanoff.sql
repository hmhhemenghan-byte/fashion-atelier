CREATE TABLE `fitting_images` (
	`id` text PRIMARY KEY NOT NULL,
	`fitting_session_id` text NOT NULL,
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
	FOREIGN KEY (`fitting_session_id`) REFERENCES `fitting_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fitting_images_image_key_unique` ON `fitting_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `fitting_images_session_sort_idx` ON `fitting_images` (`fitting_session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `fitting_images_session_status_idx` ON `fitting_images` (`fitting_session_id`,`status`);--> statement-breakpoint
CREATE TABLE `fitting_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`fitting_session_id` text NOT NULL,
	`category` text DEFAULT 'balance' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`side` text DEFAULT 'all' NOT NULL,
	`observation` text NOT NULL,
	`alteration` text DEFAULT '' NOT NULL,
	`point_code` text DEFAULT '' NOT NULL,
	`severity` text DEFAULT 'important' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`due_at` text,
	`resolved_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fitting_session_id`) REFERENCES `fitting_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fitting_issues_session_sort_idx` ON `fitting_issues` (`fitting_session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `fitting_issues_status_due_idx` ON `fitting_issues` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `fitting_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`fitting_code` text NOT NULL,
	`technical_pack_id` text NOT NULL,
	`work_id` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`sample_size` text DEFAULT '' NOT NULL,
	`fitting_at` text,
	`location` text DEFAULT '' NOT NULL,
	`fit_model_reference` text DEFAULT '' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`balance_notes` text DEFAULT '' NOT NULL,
	`silhouette_notes` text DEFAULT '' NOT NULL,
	`movement_notes` text DEFAULT '' NOT NULL,
	`comfort_notes` text DEFAULT '' NOT NULL,
	`conclusion` text DEFAULT '' NOT NULL,
	`next_fitting_at` text,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`technical_pack_id`) REFERENCES `technical_packs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fitting_sessions_fitting_code_unique` ON `fitting_sessions` (`fitting_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `fitting_sessions_pack_round_uidx` ON `fitting_sessions` (`technical_pack_id`,`round`);--> statement-breakpoint
CREATE INDEX `fitting_sessions_status_date_idx` ON `fitting_sessions` (`status`,`fitting_at`);--> statement-breakpoint
CREATE INDEX `fitting_sessions_work_updated_idx` ON `fitting_sessions` (`work_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `fitting_session_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `fitting_issue_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `fitting_image_count` integer DEFAULT 0 NOT NULL;