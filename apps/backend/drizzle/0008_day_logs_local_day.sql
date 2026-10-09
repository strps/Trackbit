-- day_logs.local_day: the user's calendar day a log belongs to, stored at write
-- time instead of derived from time_stamp + a request tz at read time. Enforces
-- one log per habit per day, which /tracker/check and /check/increment upsert on.
--
-- No BEGIN/COMMIT here: drizzle-kit migrate (the Vercel build) already runs every
-- pending migration in one transaction, and a COMMIT inside it would end that
-- transaction early and let a later failure leave the database half migrated.
--
-- The old write paths could leave several logs for one habit on one local day
-- (/tracker/check selected then inserted without a lock, and POST /day-logs always
-- inserted). Those are merged into the lowest id before the index is built: its
-- exercise sessions are moved over, rating takes the highest value (check wrote an
-- absolute rating, so a duplicate holds the same or a stale one), and distinct
-- notes are joined.

ALTER TABLE "day_logs" ADD COLUMN "local_day" date;--> statement-breakpoint
-- Users still on the 'UTC' default were served with the old server default tz.
UPDATE "day_logs" dl
SET "local_day" = (dl."time_stamp" AT TIME ZONE COALESCE(NULLIF(u."timezone", 'UTC'), 'America/Costa_Rica'))::date
FROM "habits" h
JOIN "user" u ON u."id" = h."user_id"
WHERE h."id" = dl."habit_id";--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "local_day" SET NOT NULL;--> statement-breakpoint
UPDATE "exercise_sessions" es
SET "day_log_id" = d."keep_id"
FROM (
  SELECT "id", min("id") OVER (PARTITION BY "habit_id", "local_day") AS "keep_id"
  FROM "day_logs"
) d
WHERE es."day_log_id" = d."id" AND d."id" <> d."keep_id";--> statement-breakpoint
UPDATE "day_logs" k
SET "rating" = agg."rating", "notes" = agg."notes"
FROM (
  SELECT min("id") AS "keep_id", max("rating") AS "rating", string_agg(DISTINCT "notes", E'\n') AS "notes"
  FROM "day_logs"
  GROUP BY "habit_id", "local_day"
  HAVING count(*) > 1
) agg
WHERE k."id" = agg."keep_id";--> statement-breakpoint
DELETE FROM "day_logs" d
USING "day_logs" k
WHERE k."habit_id" = d."habit_id" AND k."local_day" = d."local_day" AND k."id" < d."id";--> statement-breakpoint
CREATE UNIQUE INDEX "day_logs_habit_day_uq" ON "day_logs" USING btree ("habit_id","local_day");
