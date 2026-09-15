ALTER TABLE users ADD COLUMN username text;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN avatar_color text NOT NULL DEFAULT 'violet';
--> statement-breakpoint
CREATE UNIQUE INDEX users_username_unique ON users(username COLLATE NOCASE);
