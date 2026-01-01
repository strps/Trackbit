CREATE TYPE "public"."color_scale" AS ENUM('green', 'blue', 'orange', 'purple', 'rose', 'fire', 'custom');--> statement-breakpoint
ALTER TABLE "exercise_intervals" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_laps" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "exercise_intervals" CASCADE;--> statement-breakpoint
DROP TABLE "exercise_laps" CASCADE;--> statement-breakpoint
ALTER TABLE "exercise_sets" RENAME TO "exercise_performances";--> statement-breakpoint
ALTER TABLE "exercise_performances" DROP CONSTRAINT "exercise_sets_exercise_log_id_exercise_log_id_fk";
--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "color_palette" SET DEFAULT '[{"position":0,"color":[255,0,0,1]},{"position":0.5,"color":[255,225,0,1]},{"position":1,"color":[12,148,62,1]}]'::jsonb;--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD COLUMN "number" integer NOT NULL SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD COLUMN "duration_miliseconds" integer;--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD COLUMN "distance" numeric;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "color_theme" "color_scale" DEFAULT 'green' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD CONSTRAINT "exercise_performances_exercise_log_id_exercise_log_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "unique_user_exercise_name" UNIQUE("user_id","name");