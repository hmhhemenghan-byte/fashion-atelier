CREATE TABLE `relationship_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`opportunity_id` text,
	`kind` text DEFAULT 'note' NOT NULL,
	`channel` text DEFAULT 'internal' NOT NULL,
	`direction` text DEFAULT 'internal' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`subject` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`due_at` text,
	`occurred_at` text,
	`completed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `relationship_contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `relationship_opportunities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `relationship_activities_contact_time_idx` ON `relationship_activities` (`contact_id`,`occurred_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `relationship_activities_opportunity_idx` ON `relationship_activities` (`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `relationship_activities_status_due_idx` ON `relationship_activities` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `relationship_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_code` text NOT NULL,
	`name` text NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`role_title` text DEFAULT '' NOT NULL,
	`contact_type` text DEFAULT 'other' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`market` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`preferred_channel` text DEFAULT 'email' NOT NULL,
	`tier` text DEFAULT 'developing' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`contactability` text DEFAULT 'unknown' NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_contact_at` text,
	`next_follow_up_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relationship_contacts_contact_code_unique` ON `relationship_contacts` (`contact_code`);--> statement-breakpoint
CREATE INDEX `relationship_contacts_status_tier_idx` ON `relationship_contacts` (`status`,`tier`);--> statement-breakpoint
CREATE INDEX `relationship_contacts_type_market_idx` ON `relationship_contacts` (`contact_type`,`market`);--> statement-breakpoint
CREATE INDEX `relationship_contacts_follow_up_idx` ON `relationship_contacts` (`status`,`next_follow_up_at`);--> statement-breakpoint
CREATE INDEX `relationship_contacts_email_idx` ON `relationship_contacts` (`email`);--> statement-breakpoint
CREATE INDEX `relationship_contacts_source_idx` ON `relationship_contacts` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `relationship_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_code` text NOT NULL,
	`contact_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'editorial' NOT NULL,
	`stage` text DEFAULT 'signal' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`collection` text DEFAULT '' NOT NULL,
	`market` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`next_action_at` text,
	`outcome` text DEFAULT '' NOT NULL,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `relationship_contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relationship_opportunities_opportunity_code_unique` ON `relationship_opportunities` (`opportunity_code`);--> statement-breakpoint
CREATE INDEX `relationship_opportunities_contact_stage_idx` ON `relationship_opportunities` (`contact_id`,`stage`);--> statement-breakpoint
CREATE INDEX `relationship_opportunities_stage_action_idx` ON `relationship_opportunities` (`stage`,`next_action_at`);--> statement-breakpoint
CREATE INDEX `relationship_opportunities_priority_idx` ON `relationship_opportunities` (`priority`);--> statement-breakpoint
CREATE INDEX `relationship_opportunities_source_idx` ON `relationship_opportunities` (`source_type`,`source_id`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `relationship_contact_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `relationship_opportunity_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `relationship_activity_count` integer DEFAULT 0 NOT NULL;