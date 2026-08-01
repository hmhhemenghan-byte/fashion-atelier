CREATE TABLE `outreach_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_code` text NOT NULL,
	`title` text NOT NULL,
	`objective` text DEFAULT 'collection_launch' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`language` text DEFAULT 'bilingual' NOT NULL,
	`collection_id` text,
	`publication_id` text,
	`showroom_id` text,
	`market` text DEFAULT '' NOT NULL,
	`audience_note` text DEFAULT '' NOT NULL,
	`subject_line` text DEFAULT '' NOT NULL,
	`core_message` text DEFAULT '' NOT NULL,
	`call_to_action` text DEFAULT '' NOT NULL,
	`embargo_at` text,
	`window_start_at` text,
	`window_end_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`showroom_id`) REFERENCES `showrooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_campaigns_campaign_code_unique` ON `outreach_campaigns` (`campaign_code`);--> statement-breakpoint
CREATE INDEX `outreach_campaigns_status_window_idx` ON `outreach_campaigns` (`status`,`window_start_at`);--> statement-breakpoint
CREATE INDEX `outreach_campaigns_collection_idx` ON `outreach_campaigns` (`collection_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `outreach_campaigns_publication_idx` ON `outreach_campaigns` (`publication_id`);--> statement-breakpoint
CREATE INDEX `outreach_campaigns_showroom_idx` ON `outreach_campaigns` (`showroom_id`);--> statement-breakpoint
CREATE TABLE `outreach_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`opportunity_id` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`eligibility_snapshot` text DEFAULT 'consent_unknown' NOT NULL,
	`angle` text DEFAULT '' NOT NULL,
	`draft_subject` text DEFAULT '' NOT NULL,
	`draft_body` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`sent_at` text,
	`replied_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `outreach_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `relationship_contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `relationship_opportunities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_recipients_campaign_contact_uidx` ON `outreach_recipients` (`campaign_id`,`contact_id`);--> statement-breakpoint
CREATE INDEX `outreach_recipients_campaign_status_idx` ON `outreach_recipients` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `outreach_recipients_contact_status_idx` ON `outreach_recipients` (`contact_id`,`status`);--> statement-breakpoint
CREATE INDEX `outreach_recipients_opportunity_idx` ON `outreach_recipients` (`opportunity_id`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `outreach_campaign_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `outreach_recipient_count` integer DEFAULT 0 NOT NULL;