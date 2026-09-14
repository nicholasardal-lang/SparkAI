CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `billing_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_id` text,
	`billing_period` text,
	`subscription_status` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_stripe_customer_id_unique` ON `billing_accounts` (`stripe_customer_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_stripe_subscription_id_unique` ON `billing_accounts` (`stripe_subscription_id`);
--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`stripe_reference` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_stripe_reference_unique` ON `credit_ledger` (`stripe_reference`);
--> statement-breakpoint
CREATE INDEX `idx_credit_ledger_user_created` ON `credit_ledger` (`user_id`,`created_at`);
