CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`collection` text DEFAULT 'SECOND SKIN / AW 2027' NOT NULL,
	`look_number` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`alt_text` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `works_image_key_unique` ON `works` (`image_key`);--> statement-breakpoint
CREATE INDEX `works_status_sort_idx` ON `works` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `works_created_at_idx` ON `works` (`created_at`);