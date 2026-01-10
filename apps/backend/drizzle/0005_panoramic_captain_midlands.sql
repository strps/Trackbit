ALTER TABLE "exercise_sessions" ALTER COLUMN "date" SET DEFAULT 'today';--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "day_logs" ADD COLUMN "time_stamp" timestamp DEFAULT now();