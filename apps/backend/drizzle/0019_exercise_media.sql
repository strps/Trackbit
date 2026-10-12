CREATE TABLE "exercise_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" integer NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"position" integer NOT NULL,
	"alt_i18n" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_media_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "exercise_media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "exercise_media_mime" CHECK ("exercise_media"."mime_type" IN ('image/webp', 'image/jpeg', 'image/png')),
	CONSTRAINT "exercise_media_position_not_negative" CHECK ("exercise_media"."position" >= 0),
	CONSTRAINT "exercise_media_dimensions" CHECK ("exercise_media"."width" > 0 AND "exercise_media"."height" > 0 AND "exercise_media"."bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_media_position" ON "exercise_media" USING btree ("exercise_id","position");