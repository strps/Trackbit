-- Variant rules a CHECK can't hold, since they read other rows. Migrations apply this file's
-- statements verbatim (0018 first), and the test setup applies it after pushing the schema; keep it
-- idempotent. An exercise may be a variant of another only when:
--   - that one is a base (not itself a variant): families are one level deep;
--   - it has no variants of its own: a base can't become a variant;
--   - a system exercise points at a system exercise; a user's, at a system one or one of theirs.
-- The target is locked FOR SHARE, so a concurrent write that would make it a variant waits, and
-- this check then sees it.
CREATE OR REPLACE FUNCTION exercises_check_variant_of() RETURNS trigger AS $$
DECLARE
	target_user_id text;
	target_variant_of_id integer;
BEGIN
	IF NEW.variant_of_id IS NULL THEN
		RETURN NEW;
	END IF;
	SELECT user_id, variant_of_id INTO target_user_id, target_variant_of_id
		FROM exercises WHERE id = NEW.variant_of_id FOR SHARE;
	IF NOT FOUND THEN
		RETURN NEW; -- the foreign key reports it
	END IF;
	IF target_variant_of_id IS NOT NULL
		OR EXISTS (SELECT 1 FROM exercises WHERE variant_of_id = NEW.id)
		OR (target_user_id IS NOT NULL AND target_user_id IS DISTINCT FROM NEW.user_id) THEN
		RAISE EXCEPTION 'exercise % cannot be a variant of exercise %', NEW.id, NEW.variant_of_id
			USING ERRCODE = 'check_violation', CONSTRAINT = 'exercises_variant_of_rules';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS exercises_check_variant_of ON exercises;--> statement-breakpoint
CREATE TRIGGER exercises_check_variant_of BEFORE INSERT OR UPDATE OF variant_of_id, user_id ON exercises
	FOR EACH ROW EXECUTE FUNCTION exercises_check_variant_of();
