CREATE TABLE "exercise_intervals" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_log_id" integer NOT NULL,
	"interval_number" integer NOT NULL,
	"work_duration" integer NOT NULL,
	"rest_duration" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_laps" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_log_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"distance" real NOT NULL,
	"duration" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle_group" (
	"exercise_id" integer NOT NULL,
	"muscle_group_id" integer NOT NULL,
	CONSTRAINT "exercise_muscle_group_exercise_id_muscle_group_id_pk" PRIMARY KEY("exercise_id","muscle_group_id")
);
--> statement-breakpoint
CREATE TABLE "muscle_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "muscle_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "habits" ALTER COLUMN "color_palette" SET DEFAULT '[{"position":0,"color":[241,245,249,1]},{"position":1,"color":[16,185,129,1]}]'::jsonb;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "exercise_intervals" ADD CONSTRAINT "exercise_intervals_exercise_log_id_exercise_log_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_laps" ADD CONSTRAINT "exercise_laps_exercise_log_id_exercise_log_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" ADD CONSTRAINT "exercise_muscle_group_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_group" ADD CONSTRAINT "exercise_muscle_group_muscle_group_id_muscle_groups_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" DROP COLUMN "muscle_group";