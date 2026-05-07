CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('bug', 'feedback');--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" "issue_type" DEFAULT 'bug' NOT NULL,
	"title" varchar(255),
	"path" text,
	"description" text NOT NULL,
	"stack_trace" text,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "exercises" DROP CONSTRAINT "unique_user_exercise_name";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "name_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "description_i18n" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "unit_system" text DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_exercise_name" ON "exercises" USING btree ("user_id","name") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_system_exercise_name" ON "exercises" USING btree ((name_i18n->>'en')) WHERE user_id IS NULL;