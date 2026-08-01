CREATE TABLE `showroom_works` (
	`showroom_id` text NOT NULL,
	`work_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`sample_status` text DEFAULT 'on_request' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`showroom_id`, `work_id`),
	FOREIGN KEY (`showroom_id`) REFERENCES `showrooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `showroom_works_showroom_sort_idx` ON `showroom_works` (`showroom_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `showroom_works_work_idx` ON `showroom_works` (`work_id`);--> statement-breakpoint
CREATE TABLE `showrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`audience_label` text DEFAULT 'PRIVATE APPOINTMENT' NOT NULL,
	`introduction` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`access_token_hash` text NOT NULL,
	`access_token_hint` text NOT NULL,
	`expires_at` text,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`allow_downloads` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`activated_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showrooms_slug_unique` ON `showrooms` (`slug`);--> statement-breakpoint
CREATE INDEX `showrooms_status_updated_idx` ON `showrooms` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `showrooms_expires_at_idx` ON `showrooms` (`expires_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `showroom_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `showroom_assignment_count` integer DEFAULT 0 NOT NULL;