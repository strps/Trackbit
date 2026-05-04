CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('bug', 'feedback');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_login_enabled" boolean DEFAULT true NOT NULL,
	"github_login_enabled" boolean DEFAULT true NOT NULL,
	"password_login_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
ALTER TABLE "muscle_groups" DROP CONSTRAINT "muscle_groups_name_unique";--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" DROP CONSTRAINT "exercise_muscle_group_exercise_id_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" DROP CONSTRAINT "exercise_muscle_group_muscle_group_id_muscle_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" ADD COLUMN "role" text DEFAULT 'secondary' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" ADD COLUMN "contribution" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "display_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" ADD CONSTRAINT "exercise_muscle_group_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" ADD CONSTRAINT "exercise_muscle_group_muscle_group_id_muscle_groups_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD CONSTRAINT "muscle_groups_parent_id_muscle_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."muscle_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD CONSTRAINT "muscle_groups_slug_unique" UNIQUE("slug");