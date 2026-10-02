-- Client-chosen ids for sessions, logs and sets (offline creation). gen_random_uuid() is volatile,
-- so each existing row gets its own value.
ALTER TABLE "exercise_log" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD COLUMN "uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_log" ADD CONSTRAINT "exercise_log_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
ALTER TABLE "exercise_performances" ADD CONSTRAINT "exercise_performances_uuid_unique" UNIQUE("uuid");--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_uuid_unique" UNIQUE("uuid");