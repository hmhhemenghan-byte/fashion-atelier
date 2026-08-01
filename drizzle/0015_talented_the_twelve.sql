CREATE TABLE `design_review_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`title` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`due_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`resolved_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `design_reviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `design_review_actions_review_status_idx` ON `design_review_actions` (`review_id`,`status`);--> statement-breakpoint
CREATE INDEX `design_review_actions_status_due_idx` ON `design_review_actions` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `design_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`review_code` text NOT NULL,
	`title` text NOT NULL,
	`review_type` text DEFAULT 'concept' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`collection_id` text,
	`work_id` text,
	`brief` text DEFAULT '' NOT NULL,
	`observations` text DEFAULT '' NOT NULL,
	`conclusion` text DEFAULT '' NOT NULL,
	`reviewer_name` text DEFAULT '' NOT NULL,
	`scheduled_at` text,
	`decided_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `design_reviews_review_code_unique` ON `design_reviews` (`review_code`);--> statement-breakpoint
CREATE INDEX `design_reviews_status_schedule_idx` ON `design_reviews` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `design_reviews_collection_idx` ON `design_reviews` (`collection_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `design_reviews_work_idx` ON `design_reviews` (`work_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `design_review_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `design_review_action_count` integer DEFAULT 0 NOT NULL;