CREATE TABLE `exhibition_installation_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_installation_gate_id` text NOT NULL,
	`exhibition_delivery_item_id` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`observed_placement` text DEFAULT '' NOT NULL,
	`observed_format` text DEFAULT '' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`corrective_action` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_installation_gate_id`) REFERENCES `exhibition_installation_gates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exhibition_delivery_item_id`) REFERENCES `exhibition_delivery_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_installation_checks_gate_item_uidx` ON `exhibition_installation_checks` (`exhibition_installation_gate_id`,`exhibition_delivery_item_id`);--> statement-breakpoint
CREATE INDEX `exhibition_installation_checks_gate_sequence_idx` ON `exhibition_installation_checks` (`exhibition_installation_gate_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `exhibition_installation_checks_result_idx` ON `exhibition_installation_checks` (`result`);--> statement-breakpoint
CREATE TABLE `exhibition_installation_gates` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_code` text NOT NULL,
	`exhibition_delivery_package_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`lead_name` text DEFAULT '' NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`inspection_at` text,
	`opening_at` text,
	`installation_scope` text DEFAULT '' NOT NULL,
	`accessibility_observation` text DEFAULT '' NOT NULL,
	`rights_observation` text DEFAULT '' NOT NULL,
	`safety_note` text DEFAULT '' NOT NULL,
	`handover_note` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_delivery_package_id`) REFERENCES `exhibition_delivery_packages`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_installation_gates_gate_code_unique` ON `exhibition_installation_gates` (`gate_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_installation_gates_delivery_revision_uidx` ON `exhibition_installation_gates` (`exhibition_delivery_package_id`,`revision`);--> statement-breakpoint
CREATE INDEX `exhibition_installation_gates_status_inspection_idx` ON `exhibition_installation_gates` (`status`,`inspection_at`);--> statement-breakpoint
CREATE INDEX `exhibition_installation_gates_updated_at_idx` ON `exhibition_installation_gates` (`updated_at`);--> statement-breakpoint
CREATE TABLE `exhibition_installation_images` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_installation_gate_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`angle` text DEFAULT 'overview' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`alt_text` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_installation_gate_id`) REFERENCES `exhibition_installation_gates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_installation_images_image_key_unique` ON `exhibition_installation_images` (`image_key`);--> statement-breakpoint
CREATE INDEX `exhibition_installation_images_gate_sort_idx` ON `exhibition_installation_images` (`exhibition_installation_gate_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `exhibition_installation_images_gate_status_idx` ON `exhibition_installation_images` (`exhibition_installation_gate_id`,`status`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_installation_gate_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_installation_check_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_installation_image_count` integer DEFAULT 0 NOT NULL;