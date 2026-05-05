ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "exercise_muscle_group_exercise_id_exercises_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "exercise_muscle_group_muscle_group_id_muscle_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "exercise_muscle_group_exercise_id_muscle_group_id_pk";--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exercise_id_muscle_group_id_pk" PRIMARY KEY("exercise_id","muscle_group_id");--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "exercise_muscle_groups_muscle_group_id_muscle_groups_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE cascade ON UPDATE no action;