CREATE TABLE `conversation_memory` (
	`project_id` text PRIMARY KEY NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`through_id` text DEFAULT '' NOT NULL,
	`through_created` integer DEFAULT 0 NOT NULL,
	`task` text DEFAULT '{}' NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
