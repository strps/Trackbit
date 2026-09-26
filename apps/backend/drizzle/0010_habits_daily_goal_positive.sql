-- Audit first: SELECT id, user_id, type, daily_goal FROM habits WHERE daily_goal < 1;
-- Clients used to read a goal below 1 as 1, so raising those rows to 1 keeps what users saw.
UPDATE "habits" SET "daily_goal" = 1 WHERE "daily_goal" < 1;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_daily_goal_positive" CHECK ("habits"."daily_goal" >= 1);
