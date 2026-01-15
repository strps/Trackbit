ALTER TABLE "day_logs" ALTER COLUMN "time_stamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "time_stamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "day_logs" ALTER COLUMN "time_stamp" SET NOT NULL;