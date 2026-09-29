CREATE TABLE `studio_connections` (
	`project_id` text PRIMARY KEY NOT NULL,
	`code_hash` text,
	`code_expires` integer DEFAULT 0 NOT NULL,
	`token_hash` text,
	`token_expires` integer DEFAULT 0 NOT NULL,
	`place_id` text,
	`last_seen` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX `studio_connections_code_hash_unique` ON `studio_connections` (`code_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_connections_token_hash_unique` ON `studio_connections` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `studio_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "studio_transfers_status" CHECK("studio_transfers"."status" IN ('pending','applied','rejected'))
);

--> statement-breakpoint
CREATE UNIQUE INDEX `studio_transfers_fingerprint` ON `studio_transfers` (`project_id`,`fingerprint`);
--> statement-breakpoint
CREATE INDEX `studio_transfers_project` ON `studio_transfers` (`project_id`,`created`);
