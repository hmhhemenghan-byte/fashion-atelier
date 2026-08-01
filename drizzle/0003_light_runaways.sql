CREATE TABLE `work_process_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`stage` text DEFAULT 'research' NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`date_label` text DEFAULT '' NOT NULL,
	`image_key` text,
	`image_type` text,
	`image_size` integer,
	`alt_text` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_process_entries_image_key_unique` ON `work_process_entries` (`image_key`);--> statement-breakpoint
CREATE INDEX `work_process_work_sort_idx` ON `work_process_entries` (`work_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `work_process_work_status_idx` ON `work_process_entries` (`work_id`,`status`);--> statement-breakpoint
CREATE INDEX `work_process_stage_idx` ON `work_process_entries` (`stage`);