CREATE TABLE `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`slug` text NOT NULL,
	`headline` text NOT NULL,
	`deck` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`release_date` text DEFAULT '' NOT NULL,
	`release_at` text,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`photography` text DEFAULT '' NOT NULL,
	`styling` text DEFAULT '' NOT NULL,
	`casting` text DEFAULT '' NOT NULL,
	`hair` text DEFAULT '' NOT NULL,
	`makeup` text DEFAULT '' NOT NULL,
	`production` text DEFAULT '' NOT NULL,
	`seo_title` text DEFAULT '' NOT NULL,
	`seo_description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publications_collection_id_unique` ON `publications` (`collection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `publications_slug_unique` ON `publications` (`slug`);--> statement-breakpoint
CREATE INDEX `publications_status_release_idx` ON `publications` (`status`,`release_at`,`published_at`);--> statement-breakpoint
CREATE INDEX `publications_sort_idx` ON `publications` (`sort_order`,`created_at`);