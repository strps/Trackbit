-- De-duplicate any existing rows that would violate the unique constraint by
-- renumbering sort_order per (user_id, is_anti_habit). Tiebreakers preserve
-- the user-visible list order (sort_order, then created_at, then id).
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, is_anti_habit
            ORDER BY sort_order ASC, created_at ASC NULLS LAST, id ASC
        ) - 1 AS new_order
    FROM habits
)
UPDATE habits h
SET sort_order = r.new_order
FROM ranked r
WHERE h.id = r.id
  AND h.sort_order IS DISTINCT FROM r.new_order;
--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_anti_order_uq" UNIQUE("user_id","is_anti_habit","sort_order") DEFERRABLE INITIALLY DEFERRED;