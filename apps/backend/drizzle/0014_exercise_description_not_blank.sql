-- Blank descriptions (the old CRUD form stored '') become NULL, and blank translations are dropped.
UPDATE "exercises" SET "description" = NULL WHERE btrim("description") = '';--> statement-breakpoint
UPDATE "exercises" SET "description_i18n" = (
	SELECT jsonb_object_agg(key, value) FROM jsonb_each_text("exercises"."description_i18n") WHERE btrim(value) <> ''
) WHERE "description_i18n" IS NOT NULL;--> statement-breakpoint
UPDATE "muscle_groups" SET "description_i18n" = (
	SELECT jsonb_object_agg(key, value) FROM jsonb_each_text("muscle_groups"."description_i18n") WHERE btrim(value) <> ''
) WHERE "description_i18n" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_description_not_blank" CHECK ("exercises"."description" IS NULL OR btrim("exercises"."description") <> '');
