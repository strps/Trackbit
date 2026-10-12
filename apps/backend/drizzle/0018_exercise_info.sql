CREATE TYPE "public"."exercise_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."exercise_equipment" AS ENUM('barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'bench', 'pull_up_bar', 'other');--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "instructions" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "instructions_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "tips" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "tips_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "common_mistakes" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "common_mistakes_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "equipment" "exercise_equipment"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "difficulty" "exercise_difficulty";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "variant_of_id" integer;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_variant_of_id_exercises_id_fk" FOREIGN KEY ("variant_of_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercises_variant_of_idx" ON "exercises" USING btree ("variant_of_id");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_instructions_not_empty" CHECK ("exercises"."instructions" IS NULL OR (jsonb_typeof("exercises"."instructions") = 'array' AND jsonb_array_length("exercises"."instructions") > 0
        AND NOT jsonb_path_exists("exercises"."instructions", '$[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_instructions_i18n_not_empty" CHECK ("exercises"."instructions_i18n" IS NULL OR (jsonb_typeof("exercises"."instructions_i18n") = 'object' AND "exercises"."instructions_i18n" <> '{}'::jsonb
        AND NOT jsonb_path_exists("exercises"."instructions_i18n", 'strict $.* ? (@.type() != "array" || @.size() == 0)')
        AND NOT jsonb_path_exists("exercises"."instructions_i18n", '$.*[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_tips_not_empty" CHECK ("exercises"."tips" IS NULL OR (jsonb_typeof("exercises"."tips") = 'array' AND jsonb_array_length("exercises"."tips") > 0
        AND NOT jsonb_path_exists("exercises"."tips", '$[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_tips_i18n_not_empty" CHECK ("exercises"."tips_i18n" IS NULL OR (jsonb_typeof("exercises"."tips_i18n") = 'object' AND "exercises"."tips_i18n" <> '{}'::jsonb
        AND NOT jsonb_path_exists("exercises"."tips_i18n", 'strict $.* ? (@.type() != "array" || @.size() == 0)')
        AND NOT jsonb_path_exists("exercises"."tips_i18n", '$.*[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_common_mistakes_not_empty" CHECK ("exercises"."common_mistakes" IS NULL OR (jsonb_typeof("exercises"."common_mistakes") = 'array' AND jsonb_array_length("exercises"."common_mistakes") > 0
        AND NOT jsonb_path_exists("exercises"."common_mistakes", '$[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_common_mistakes_i18n_not_empty" CHECK ("exercises"."common_mistakes_i18n" IS NULL OR (jsonb_typeof("exercises"."common_mistakes_i18n") = 'object' AND "exercises"."common_mistakes_i18n" <> '{}'::jsonb
        AND NOT jsonb_path_exists("exercises"."common_mistakes_i18n", 'strict $.* ? (@.type() != "array" || @.size() == 0)')
        AND NOT jsonb_path_exists("exercises"."common_mistakes_i18n", '$.*[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')));--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_variant_of_not_self" CHECK ("exercises"."variant_of_id" IS DISTINCT FROM "exercises"."id");--> statement-breakpoint
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
