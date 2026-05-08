ALTER TABLE "app_limits" RENAME TO "user_limits";--> statement-breakpoint
ALTER TABLE "user_limits" DROP CONSTRAINT "app_limits_role_unique";--> statement-breakpoint
ALTER TABLE "user_limits" ADD CONSTRAINT "user_limits_role_unique" UNIQUE("role");