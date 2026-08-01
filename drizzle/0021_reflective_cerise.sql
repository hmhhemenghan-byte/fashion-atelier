CREATE TABLE `production_exception_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`production_exception_id` text NOT NULL,
	`action_type` text DEFAULT 'review_note' NOT NULL,
	`note` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`production_exception_id`) REFERENCES `production_exceptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `production_exception_actions_exception_time_idx` ON `production_exception_actions` (`production_exception_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `production_exception_actions_type_idx` ON `production_exception_actions` (`action_type`);--> statement-breakpoint
CREATE TABLE `production_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`exception_code` text NOT NULL,
	`production_release_id` text NOT NULL,
	`work_id` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`title` text NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`source_reference` text DEFAULT '' NOT NULL,
	`affected_scope` text DEFAULT '' NOT NULL,
	`observed_deviation` text DEFAULT '' NOT NULL,
	`proposed_response` text DEFAULT '' NOT NULL,
	`design_impact` text DEFAULT '' NOT NULL,
	`quality_risk` text DEFAULT '' NOT NULL,
	`evidence_reference` text DEFAULT '' NOT NULL,
	`owner_name` text DEFAULT '' NOT NULL,
	`discovered_at` text,
	`due_at` text,
	`decided_by` text DEFAULT '' NOT NULL,
	`decided_at` text,
	`verification_note` text DEFAULT '' NOT NULL,
	`verified_by` text DEFAULT '' NOT NULL,
	`verified_at` text,
	`resolution_note` text DEFAULT '' NOT NULL,
	`successor_release_code` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`production_release_id`) REFERENCES `production_releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_exceptions_exception_code_unique` ON `production_exceptions` (`exception_code`);--> statement-breakpoint
CREATE INDEX `production_exceptions_release_status_idx` ON `production_exceptions` (`production_release_id`,`status`);--> statement-breakpoint
CREATE INDEX `production_exceptions_work_updated_idx` ON `production_exceptions` (`work_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `production_exceptions_status_due_idx` ON `production_exceptions` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `production_exceptions_severity_idx` ON `production_exceptions` (`severity`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_exception_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `production_exception_action_count` integer DEFAULT 0 NOT NULL;