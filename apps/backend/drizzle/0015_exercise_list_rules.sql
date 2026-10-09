-- List rules (E4). Before applying in production, audit names that would collide once trimmed
-- (the unique index would fail the UPDATE below):
--   SELECT user_id, btrim(name), count(*) FROM exercise_lists GROUP BY 1, 2 HAVING count(*) > 1;
UPDATE "exercise_lists" SET "name" = 'List ' || "id" WHERE btrim("name") = '';--> statement-breakpoint
UPDATE "exercise_lists" SET "name" = btrim("name") WHERE "name" <> btrim("name");--> statement-breakpoint
UPDATE "exercise_lists" SET "description" = NULL WHERE btrim("description") = '';--> statement-breakpoint
UPDATE "exercise_list_items" SET "notes" = NULL WHERE btrim("notes") = '';--> statement-breakpoint
-- A zero target meant nothing; it is "not prescribed" now.
UPDATE "exercise_list_items" SET
	"target_sets" = NULLIF("target_sets", 0),
	"target_reps" = NULLIF("target_reps", 0),
	"target_weight" = NULLIF("target_weight", 0),
	"target_duration" = NULLIF("target_duration", 0),
	"target_distance" = NULLIF("target_distance", 0),
	-- Not LEAST(): it skips NULLs, so an unset rest would become 3600.
	"rest_seconds" = CASE WHEN "rest_seconds" > 3600 THEN 3600 ELSE "rest_seconds" END;--> statement-breakpoint
-- Prescriptions were in the exercise's default units; they are kg and km now, like sets.
UPDATE "exercise_list_items" SET "target_weight" = round(("target_weight" / 2.20462)::numeric, 2)
	FROM "exercises" WHERE "exercises"."id" = "exercise_list_items"."exercise_id"
	AND "exercises"."default_weight_unit" = 'lbs' AND "target_weight" IS NOT NULL;--> statement-breakpoint
UPDATE "exercise_list_items" SET "target_distance" = round(("target_distance" * 1.609344)::numeric, 3)
	FROM "exercises" WHERE "exercises"."id" = "exercise_list_items"."exercise_id"
	AND "exercises"."default_distance_unit" = 'miles' AND "target_distance" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_prescription_positive" CHECK (("exercise_list_items"."target_sets" IS NULL OR "exercise_list_items"."target_sets" >= 1)
            AND ("exercise_list_items"."target_reps" IS NULL OR "exercise_list_items"."target_reps" >= 1)
            AND ("exercise_list_items"."target_weight" IS NULL OR "exercise_list_items"."target_weight" > 0)
            AND ("exercise_list_items"."target_duration" IS NULL OR "exercise_list_items"."target_duration" >= 1)
            AND ("exercise_list_items"."target_distance" IS NULL OR "exercise_list_items"."target_distance" > 0)
            AND ("exercise_list_items"."rest_seconds" IS NULL OR "exercise_list_items"."rest_seconds" BETWEEN 0 AND 3600));--> statement-breakpoint
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_notes_not_blank" CHECK ("exercise_list_items"."notes" IS NULL OR btrim("exercise_list_items"."notes") <> '');--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_name_trimmed" CHECK ("exercise_lists"."name" = btrim("exercise_lists"."name") AND "exercise_lists"."name" <> '');--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_description_not_blank" CHECK ("exercise_lists"."description" IS NULL OR btrim("exercise_lists"."description") <> '');