ALTER TABLE users ADD COLUMN email_verified_at integer;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN email_verification_required integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE auth_tokens (
  token_hash text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('email_verification','password_reset')),
  expires integer NOT NULL,
  created_at integer NOT NULL,
  used_at integer
);
--> statement-breakpoint
CREATE INDEX auth_tokens_user_purpose ON auth_tokens(user_id,purpose,expires);
