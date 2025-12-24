CREATE TYPE "public"."habit_type" AS ENUM('simple', 'complex', 'negative', 'timed');--> statement-breakpoint
CREATE TABLE "day_logs" (
	"habit_id" integer NOT NULL,
	"date" date NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "day_logs_habit_id_date_pk" PRIMARY KEY("habit_id","date")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "habit_type" DEFAULT 'simple' NOT NULL,
	"color_palette" jsonb DEFAULT '[{"position":0,"color":[241,245,249]},{"position":1,"color":[16,185,129]}]'::jsonb NOT NULL,
	"icon" text DEFAULT 'star' NOT NULL,
	"weekly_goal" integer DEFAULT 5 NOT NULL,
	"daily_goal" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"distance" real,
	"duration" integer,
	"distance_unit" text DEFAULT 'km',
	"weight_unit" text DEFAULT 'kg'
);
--> statement-breakpoint
CREATE TABLE "exercise_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"habit_id" integer NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercise_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_log_id" integer NOT NULL,
	"reps" integer,
	"weight" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"category" text DEFAULT 'strength' NOT NULL,
	"muscle_group" text,
	"default_weight_unit" text DEFAULT 'kg',
	"default_distance_unit" text DEFAULT 'km',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"max_habits" integer DEFAULT 10,
	"max_custom_exercises" integer DEFAULT 5,
	"allowed_habit_types" text[] DEFAULT '{"simple","complex"}',
	CONSTRAINT "app_limits_role_unique" UNIQUE("role")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"email" text,
	"invited_by" text,
	"role" text DEFAULT 'tester' NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"consumed_at" timestamp,
	CONSTRAINT "invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "day_logs" ADD CONSTRAINT "day_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_log" ADD CONSTRAINT "exercise_log_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_log" ADD CONSTRAINT "exercise_log_session_id_exercise_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "exercise_sessions_habit_id_date_day_logs_habit_id_date_fk" FOREIGN KEY ("habit_id","date") REFERENCES "public"."day_logs"("habit_id","date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_exercise_log_id_exercise_log_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;