-- Issue rules (E6): text trimmed, no blank optional fields. Legacy rows are cleaned first so the
-- CHECKs apply (the route accepted untrimmed text and an empty path).
UPDATE "issues" SET "description" = '(empty)' WHERE btrim("description") = '';--> statement-breakpoint
UPDATE "issues" SET
	"description" = btrim("description"),
	"title" = NULLIF(btrim("title"), ''),
	"path" = NULLIF(btrim("path"), ''),
	"stack_trace" = NULLIF(btrim("stack_trace"), '');--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "client" varchar(255);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_description_not_blank" CHECK (btrim("issues"."description") <> '');--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_optional_not_blank" CHECK (("issues"."title" IS NULL OR btrim("issues"."title") <> '')
            AND ("issues"."path" IS NULL OR btrim("issues"."path") <> '')
            AND ("issues"."client" IS NULL OR btrim("issues"."client") <> '')
            AND ("issues"."stack_trace" IS NULL OR btrim("issues"."stack_trace") <> ''));