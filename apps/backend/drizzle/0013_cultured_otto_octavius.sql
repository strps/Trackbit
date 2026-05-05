CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('bug', 'feedback');--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"type" "issue_type" DEFAULT 'bug' NOT NULL,
	"title" varchar(255),
	"path" text,
	"description" text NOT NULL,
	"stack_trace" text,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
