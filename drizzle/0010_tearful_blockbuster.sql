CREATE TABLE `sample_communications` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`kind` text DEFAULT 'custom' NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`direction` text DEFAULT 'outbound' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`recipient_name` text DEFAULT '' NOT NULL,
	`recipient_address` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`follow_up_at` text,
	`occurred_at` text,
	`resolved_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `sample_loans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sample_communications_loan_created_idx` ON `sample_communications` (`loan_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sample_communications_follow_up_idx` ON `sample_communications` (`status`,`follow_up_at`);--> statement-breakpoint
CREATE INDEX `sample_communications_kind_idx` ON `sample_communications` (`kind`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `sample_communication_count` integer DEFAULT 0 NOT NULL;