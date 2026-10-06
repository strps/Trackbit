-- Client-chosen ids for habits, exercises, lists and list items (Phase 4, offline creation), as 0011
-- did for sessions. gen_random_uuid() is volatile, so each existing row gets its own value.
ALTER TABLE "habits" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_list_items" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
-- List source keys name the list by uuid now (`list:<uuid>`): rewrite the stored preferences, and
-- forget one whose list is gone (the picker treats a dangling key as browse mode anyway).
UPDATE "user" SET "preferred_exercise_source" = (
	SELECT 'list:' || l."uuid" FROM "exercise_lists" l
	WHERE l."id" = substring("user"."preferred_exercise_source" FROM 6)::int AND l."user_id" = "user"."id"
) WHERE "preferred_exercise_source" ~ '^list:[0-9]+$';