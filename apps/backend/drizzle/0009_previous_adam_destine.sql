-- Step 1: Drop old FK from exercise_sessions referencing composite PK on day_logs
ALTER TABLE "exercise_sessions" DROP CONSTRAINT "exercise_sessions_habit_id_date_day_logs_habit_id_date_fk";
--> statement-breakpoint

-- Step 2: Drop composite primary key on day_logs
ALTER TABLE "day_logs" DROP CONSTRAINT "day_logs_habit_id_date_pk";
--> statement-breakpoint

-- Step 3: Add new serial id column to day_logs and make it the primary key
ALTER TABLE "day_logs" ADD COLUMN "id" serial NOT NULL;
--> statement-breakpoint
ALTER TABLE "day_logs" ADD CONSTRAINT "day_logs_pkey" PRIMARY KEY ("id");
--> statement-breakpoint

-- Step 4: Add day_log_id column to exercise_sessions (nullable for now)
ALTER TABLE "exercise_sessions" ADD COLUMN "day_log_id" integer;
--> statement-breakpoint

-- Step 5: Populate day_log_id by matching the old habit_id + date composite key
UPDATE "exercise_sessions" es
SET "day_log_id" = dl."id"
FROM "day_logs" dl
WHERE es."habit_id" = dl."habit_id" AND es."date" = dl."date";
--> statement-breakpoint

-- Step 6: Make day_log_id NOT NULL now that it's populated
ALTER TABLE "exercise_sessions" ALTER COLUMN "day_log_id" SET NOT NULL;
--> statement-breakpoint

-- Step 7: Drop the old date column from day_logs
ALTER TABLE "day_logs" DROP COLUMN "date";
--> statement-breakpoint

-- Step 8: Drop old habit_id and date columns from exercise_sessions
ALTER TABLE "exercise_sessions" DROP COLUMN "habit_id";
--> statement-breakpoint
ALTER TABLE "exercise_sessions" DROP COLUMN "date";
--> statement-breakpoint

-- Step 9: Add the new FK constraint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_day_log_id_day_logs_id_fk" FOREIGN KEY ("day_log_id") REFERENCES "public"."day_logs"("id") ON DELETE cascade ON UPDATE no action;