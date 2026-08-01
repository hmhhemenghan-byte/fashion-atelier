CREATE TABLE `editorial_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`event_type` text DEFAULT 'internal' NOT NULL,
	`channel` text DEFAULT 'atelier' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`priority` text DEFAULT 'standard' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`timezone` text DEFAULT 'Europe/Paris' NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`collection_id` text,
	`work_id` text,
	`publication_id` text,
	`created_by` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `editorial_events_start_status_idx` ON `editorial_events` (`starts_at`,`status`);--> statement-breakpoint
CREATE INDEX `editorial_events_collection_idx` ON `editorial_events` (`collection_id`);--> statement-breakpoint
CREATE INDEX `editorial_events_work_idx` ON `editorial_events` (`work_id`);--> statement-breakpoint
CREATE INDEX `editorial_events_publication_idx` ON `editorial_events` (`publication_id`);