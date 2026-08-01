CREATE TABLE `sample_loan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`request_item_id` text,
	`work_id` text,
	`work_title` text NOT NULL,
	`look_number` text DEFAULT '' NOT NULL,
	`image_key` text DEFAULT '' NOT NULL,
	`sample_code` text DEFAULT '' NOT NULL,
	`size_label` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`outbound_condition` text DEFAULT 'not_checked' NOT NULL,
	`return_condition` text DEFAULT 'not_checked' NOT NULL,
	`condition_notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `sample_loans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_item_id`) REFERENCES `showroom_request_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sample_loan_items_loan_sort_idx` ON `sample_loan_items` (`loan_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `sample_loan_items_status_idx` ON `sample_loan_items` (`status`);--> statement-breakpoint
CREATE INDEX `sample_loan_items_work_idx` ON `sample_loan_items` (`work_id`);--> statement-breakpoint
CREATE TABLE `sample_loans` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`loan_code` text NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`delivery_address` text DEFAULT '' NOT NULL,
	`outbound_carrier` text DEFAULT '' NOT NULL,
	`outbound_tracking` text DEFAULT '' NOT NULL,
	`outbound_sent_at` text,
	`delivered_at` text,
	`expected_return_at` text,
	`return_carrier` text DEFAULT '' NOT NULL,
	`return_tracking` text DEFAULT '' NOT NULL,
	`return_received_at` text,
	`logistics_notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`closed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `showroom_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sample_loans_request_id_unique` ON `sample_loans` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sample_loans_loan_code_unique` ON `sample_loans` (`loan_code`);--> statement-breakpoint
CREATE INDEX `sample_loans_status_return_idx` ON `sample_loans` (`status`,`expected_return_at`);--> statement-breakpoint
CREATE INDEX `sample_loans_created_at_idx` ON `sample_loans` (`created_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_loan_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_loan_item_count` integer DEFAULT 0 NOT NULL;