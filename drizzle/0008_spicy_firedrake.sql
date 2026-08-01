CREATE TABLE `showroom_request_items` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`work_id` text,
	`work_title` text NOT NULL,
	`look_number` text DEFAULT '' NOT NULL,
	`image_key` text DEFAULT '' NOT NULL,
	`sample_status` text DEFAULT 'on_request' NOT NULL,
	`item_note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `showroom_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `showroom_request_items_request_sort_idx` ON `showroom_request_items` (`request_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `showroom_request_items_work_idx` ON `showroom_request_items` (`work_id`);--> statement-breakpoint
CREATE TABLE `showroom_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`showroom_id` text NOT NULL,
	`reference_code` text NOT NULL,
	`requester_name` text NOT NULL,
	`requester_email` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`requester_role` text NOT NULL,
	`purpose` text NOT NULL,
	`project_title` text NOT NULL,
	`needed_from` text,
	`needed_until` text,
	`delivery_city` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`internal_notes` text DEFAULT '' NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`showroom_id`) REFERENCES `showrooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `showroom_requests_reference_code_unique` ON `showroom_requests` (`reference_code`);--> statement-breakpoint
CREATE INDEX `showroom_requests_showroom_created_idx` ON `showroom_requests` (`showroom_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `showroom_requests_status_created_idx` ON `showroom_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `showroom_requests_email_created_idx` ON `showroom_requests` (`requester_email`,`created_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `showroom_request_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `showroom_request_item_count` integer DEFAULT 0 NOT NULL;