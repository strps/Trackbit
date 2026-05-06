ALTER TABLE "exercises" DROP CONSTRAINT "unique_user_exercise_name";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_exercise_name" ON "exercises" USING btree ("user_id","name") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_system_exercise_name" ON "exercises" USING btree ((name_i18n->>'en')) WHERE user_id IS NULL;--> statement-breakpoint
UPDATE "exercises" SET "name_i18n" = jsonb_build_object('en', "name") WHERE "user_id" IS NULL AND "name_i18n" IS NULL;--> statement-breakpoint
UPDATE "exercises" SET "description_i18n" = jsonb_build_object('en', "description") WHERE "user_id" IS NULL AND "description" IS NOT NULL AND "description_i18n" IS NULL;--> statement-breakpoint
UPDATE "muscle_groups" SET "name_i18n" = jsonb_build_object('en', "name") WHERE "name_i18n" IS NULL;--> statement-breakpoint
UPDATE "muscle_groups" SET "description_i18n" = jsonb_build_object('en', "description") WHERE "description" IS NOT NULL AND "description_i18n" IS NULL;