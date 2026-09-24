-- day_logs.local_day: the user's calendar day a log belongs to, stored at write
-- time instead of derived from time_stamp + a request tz at read time. Enforces
-- one log per habit per day, which /tracker/check and /check/increment upsert on.
--
-- Apply with: psql "$DATABASE_URL" -f drizzle/0008_day_logs_local_day.sql
-- Runs in one transaction: if duplicates exist the unique index fails and
-- nothing is changed. Pre-flight audit (must return 0 rows):
--
--   SELECT dl.habit_id,
--          (dl.time_stamp AT TIME ZONE COALESCE(NULLIF(u.timezone, 'UTC'), 'America/Costa_Rica'))::date AS day,
--          count(*), array_agg(dl.id ORDER BY dl.id) AS ids
--   FROM day_logs dl
--   JOIN habits h ON h.id = dl.habit_id
--   JOIN "user" u ON u.id = h.user_id
--   GROUP BY 1, 2 HAVING count(*) > 1;

BEGIN;--> statement-breakpoint
ALTER TABLE "day_logs" ADD COLUMN "local_day" date;--> statement-breakpoint
-- Users still on the 'UTC' default were served with the old server default tz.
UPDATE "day_logs" dl
SET "local_day" = (dl."time_stamp" AT TIME ZONE COALESCE(NULLIF(u."timezone", 'UTC'), 'America/Costa_Rica'))::date
FROM "habits" h
JOIN "user" u ON u."id" = h."user_id"
WHERE h."id" = dl."habit_id";--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "local_day" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "day_logs_habit_day_uq" ON "day_logs" USING btree ("habit_id","local_day");--> statement-breakpoint
COMMIT;
