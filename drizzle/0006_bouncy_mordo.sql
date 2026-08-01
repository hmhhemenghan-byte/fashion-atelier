CREATE TABLE `archive_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`manifest_hash` text NOT NULL,
	`data_json` text NOT NULL,
	`work_count` integer DEFAULT 0 NOT NULL,
	`collection_count` integer DEFAULT 0 NOT NULL,
	`process_count` integer DEFAULT 0 NOT NULL,
	`publication_count` integer DEFAULT 0 NOT NULL,
	`calendar_event_count` integer DEFAULT 0 NOT NULL,
	`media_count` integer DEFAULT 0 NOT NULL,
	`media_bytes` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `archive_snapshots_created_at_idx` ON `archive_snapshots` (`created_at`);--> statement-breakpoint
CREATE INDEX `archive_snapshots_manifest_hash_idx` ON `archive_snapshots` (`manifest_hash`);