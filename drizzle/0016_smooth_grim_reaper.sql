CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`material_code` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'fabric' NOT NULL,
	`status` text DEFAULT 'research' NOT NULL,
	`composition` text DEFAULT '' NOT NULL,
	`construction` text DEFAULT '' NOT NULL,
	`color_name` text DEFAULT '' NOT NULL,
	`color_code` text DEFAULT '' NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`supplier_reference` text DEFAULT '' NOT NULL,
	`origin` text DEFAULT '' NOT NULL,
	`weight` text DEFAULT '' NOT NULL,
	`width` text DEFAULT '' NOT NULL,
	`hand_feel` text DEFAULT '' NOT NULL,
	`finish` text DEFAULT '' NOT NULL,
	`certifications` text DEFAULT '' NOT NULL,
	`swatch_image_key` text,
	`swatch_image_type` text,
	`swatch_image_size` integer,
	`swatch_alt_text` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_material_code_unique` ON `materials` (`material_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `materials_swatch_image_key_unique` ON `materials` (`swatch_image_key`);--> statement-breakpoint
CREATE INDEX `materials_status_category_idx` ON `materials` (`status`,`category`);--> statement-breakpoint
CREATE INDEX `materials_supplier_idx` ON `materials` (`supplier_name`);--> statement-breakpoint
CREATE INDEX `materials_updated_at_idx` ON `materials` (`updated_at`);--> statement-breakpoint
CREATE TABLE `work_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`material_id` text NOT NULL,
	`role` text DEFAULT 'shell' NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`placement` text DEFAULT '' NOT NULL,
	`colorway` text DEFAULT '' NOT NULL,
	`consumption` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'm' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_materials_work_sort_idx` ON `work_materials` (`work_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `work_materials_material_idx` ON `work_materials` (`material_id`);--> statement-breakpoint
CREATE INDEX `work_materials_status_idx` ON `work_materials` (`status`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `material_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `work_material_count` integer DEFAULT 0 NOT NULL;