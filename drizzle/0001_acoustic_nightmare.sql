ALTER TABLE `users` ADD `legal_version` text;--> statement-breakpoint
ALTER TABLE `users` ADD `legal_accepted_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `workspace_enabled` integer DEFAULT 0 NOT NULL;