CREATE TABLE `project_assets` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `spec_json` text NOT NULL,
  `created` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_assets_created` ON `project_assets` (`project_id`,`created`);
--> statement-breakpoint
CREATE TABLE `scene_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `prompt` text NOT NULL,
  `status` text NOT NULL,
  `plan_json` text,
  `assets_json` text DEFAULT '[]' NOT NULL,
  `error` text,
  `lease_token` text,
  `created` integer NOT NULL,
  `updated` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `scene_jobs_status_check` CHECK (`status` IN ('queued','running','complete','failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_scene_jobs_project_created` ON `scene_jobs` (`project_id`,`created`);
