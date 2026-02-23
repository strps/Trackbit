ALTER TABLE "habits" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "type" SET DEFAULT 'count'::text;--> statement-breakpoint
DROP TYPE "public"."habit_type";--> statement-breakpoint
CREATE TYPE "public"."habit_type" AS ENUM('count', 'complex', 'negative', 'timed', 'check');--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "type" SET DEFAULT 'count'::"public"."habit_type";--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "type" SET DATA TYPE "public"."habit_type" USING "type"::"public"."habit_type";--> statement-breakpoint
ALTER TABLE "app_limits" ALTER COLUMN "allowed_habit_types" SET DEFAULT '{"count","complex"}';--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "is_anti_habit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;