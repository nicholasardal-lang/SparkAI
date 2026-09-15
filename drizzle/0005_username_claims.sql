CREATE TABLE username_claims (
  username text PRIMARY KEY NOT NULL,
  user_id text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER users_claim_username_insert BEFORE INSERT ON users
WHEN NEW.username IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'USERNAME_TAKEN') WHERE EXISTS (
    SELECT 1 FROM username_claims WHERE username=lower(NEW.username) AND user_id<>NEW.id
  );
  INSERT INTO username_claims(username,user_id) VALUES(lower(NEW.username),NEW.id)
    ON CONFLICT(username) DO NOTHING;
END;
--> statement-breakpoint
CREATE TRIGGER users_claim_username_update BEFORE UPDATE OF username ON users
WHEN NEW.username IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'USERNAME_TAKEN') WHERE EXISTS (
    SELECT 1 FROM username_claims WHERE username=lower(NEW.username) AND user_id<>NEW.id
  );
  INSERT INTO username_claims(username,user_id) VALUES(lower(NEW.username),NEW.id)
    ON CONFLICT(username) DO NOTHING;
END;
