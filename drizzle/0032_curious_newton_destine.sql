CREATE TABLE `exhibition_opening_gates` (
	`id` text PRIMARY KEY NOT NULL,
	`opening_code` text NOT NULL,
	`curatorial_project_id` text NOT NULL,
	`exhibition_installation_gate_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`opening_lead` text DEFAULT '' NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`planned_opening_at` text,
	`planned_closing_at` text,
	`operating_brief` text DEFAULT '' NOT NULL,
	`daily_check_cadence` text DEFAULT '' NOT NULL,
	`staff_handover` text DEFAULT '' NOT NULL,
	`visitor_accessibility_plan` text DEFAULT '' NOT NULL,
	`incident_escalation` text DEFAULT '' NOT NULL,
	`emergency_pause_rule` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text,
	`closed_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`curatorial_project_id`) REFERENCES `curatorial_projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`exhibition_installation_gate_id`) REFERENCES `exhibition_installation_gates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_opening_gates_opening_code_unique` ON `exhibition_opening_gates` (`opening_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_opening_gates_project_revision_uidx` ON `exhibition_opening_gates` (`curatorial_project_id`,`revision`);--> statement-breakpoint
CREATE INDEX `exhibition_opening_gates_status_opening_idx` ON `exhibition_opening_gates` (`status`,`planned_opening_at`);--> statement-breakpoint
CREATE INDEX `exhibition_opening_gates_updated_at_idx` ON `exhibition_opening_gates` (`updated_at`);--> statement-breakpoint
CREATE TABLE `exhibition_opening_items` (
	`id` text PRIMARY KEY NOT NULL,
	`exhibition_opening_gate_id` text NOT NULL,
	`curatorial_selection_id` text NOT NULL,
	`exhibition_readiness_plan_id` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`display_location` text DEFAULT '' NOT NULL,
	`readiness_note` text DEFAULT '' NOT NULL,
	`handover_note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exhibition_opening_gate_id`) REFERENCES `exhibition_opening_gates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`curatorial_selection_id`) REFERENCES `curatorial_selections`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`exhibition_readiness_plan_id`) REFERENCES `exhibition_readiness_plans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exhibition_opening_items_gate_selection_uidx` ON `exhibition_opening_items` (`exhibition_opening_gate_id`,`curatorial_selection_id`);--> statement-breakpoint
CREATE INDEX `exhibition_opening_items_gate_sequence_idx` ON `exhibition_opening_items` (`exhibition_opening_gate_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `exhibition_opening_items_result_idx` ON `exhibition_opening_items` (`result`);--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_opening_gate_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `archive_snapshots` ADD `exhibition_opening_item_count` integer DEFAULT 0 NOT NULL;