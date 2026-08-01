CREATE TABLE `collection_works` (
	`collection_id` text NOT NULL,
	`work_id` text NOT NULL,
	`look_number` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`collection_id`, `work_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_works_collection_sort_idx` ON `collection_works` (`collection_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `collection_works_work_idx` ON `collection_works` (`work_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`season` text DEFAULT '' NOT NULL,
	`year` integer NOT NULL,
	`statement` text DEFAULT '' NOT NULL,
	`hero_image_key` text,
	`hero_image_type` text,
	`hero_image_size` integer,
	`hero_alt_text` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `collections_hero_image_key_unique` ON `collections` (`hero_image_key`);--> statement-breakpoint
CREATE INDEX `collections_status_sort_idx` ON `collections` (`status`,`sort_order`,`published_at`);--> statement-breakpoint
CREATE INDEX `collections_featured_idx` ON `collections` (`featured`,`status`);--> statement-breakpoint
INSERT OR IGNORE INTO `collections` (
	`id`,
	`slug`,
	`title`,
	`subtitle`,
	`season`,
	`year`,
	`statement`,
	`hero_alt_text`,
	`status`,
	`featured`,
	`sort_order`,
	`created_by`,
	`published_at`
) VALUES (
	'second-skin-aw27',
	'second-skin-aw27',
	'SECOND SKIN',
	'FORM / MOTION',
	'AUTUMN—WINTER',
	2027,
	'在结构与流动之间，重塑身体的边界。衣服不是覆盖身体，而是身体运动留下的轨迹。',
	'身着黑色与深酒红雕塑廓形服装的模特',
	'published',
	1,
	0,
	'system',
	CURRENT_TIMESTAMP
);--> statement-breakpoint
INSERT OR IGNORE INTO `collection_works` (
	`collection_id`,
	`work_id`,
	`look_number`,
	`sort_order`,
	`featured`
)
SELECT
	'second-skin-aw27',
	`id`,
	`look_number`,
	`sort_order`,
	0
FROM `works`
WHERE `collection` LIKE '%SECOND SKIN%';
