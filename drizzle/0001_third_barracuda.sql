CREATE TABLE `work_images` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`label` text DEFAULT 'DETAIL' NOT NULL,
	`alt_text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_images_image_key_unique` ON `work_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `work_images_work_sort_idx` ON `work_images` (`work_id`,`sort_order`);