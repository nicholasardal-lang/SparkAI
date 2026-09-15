ALTER TABLE billing_accounts ADD COLUMN paid_until integer;
--> statement-breakpoint
ALTER TABLE billing_accounts ADD COLUMN period_start integer;
--> statement-breakpoint
ALTER TABLE billing_accounts ADD COLUMN cancel_at_period_end integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE credit_buckets (id text PRIMARY KEY NOT NULL,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,remaining integer NOT NULL CHECK(remaining>=0),expires integer,source text NOT NULL);
--> statement-breakpoint
CREATE INDEX credit_buckets_user ON credit_buckets(user_id);
--> statement-breakpoint
CREATE TABLE credit_locks (user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,request_id text NOT NULL,expires integer NOT NULL,parts text NOT NULL DEFAULT '[]');
