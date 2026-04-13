CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"google_login_enabled" boolean DEFAULT true NOT NULL,
	"github_login_enabled" boolean DEFAULT true NOT NULL,
	"password_login_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);

-- Seed the default settings row
INSERT INTO "app_settings" ("google_login_enabled", "github_login_enabled", "password_login_enabled")
VALUES (true, true, true);
