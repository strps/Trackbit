CREATE TABLE "exercise_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"list_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"position" integer NOT NULL,
	"target_sets" integer,
	"target_reps" integer,
	"target_weight" real,
	"target_duration" integer,
	"target_distance" real,
	"rest_seconds" integer,
	"notes" text,
	-- DEFERRABLE INITIALLY DEFERRED (hand-added; drizzle-kit cannot emit it, same
	-- as habits_user_anti_order_uq in 0003) so PUT /:id/items can move items
	-- through conflicting intermediate positions inside a transaction.
	CONSTRAINT "exercise_list_items_list_position_uq" UNIQUE("list_id","position") DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
CREATE TABLE "exercise_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"author_id" text,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "exercise_log" ADD COLUMN "list_item_id" integer;--> statement-breakpoint
ALTER TABLE "user_limits" ADD COLUMN "max_exercise_lists" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_list_id_exercise_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."exercise_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_list_items" ADD CONSTRAINT "exercise_list_items_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_lists_user_name_uq" ON "exercise_lists" USING btree ("user_id","name");--> statement-breakpoint
ALTER TABLE "exercise_log" ADD CONSTRAINT "exercise_log_list_item_id_exercise_list_items_id_fk" FOREIGN KEY ("list_item_id") REFERENCES "public"."exercise_list_items"("id") ON DELETE set null ON UPDATE no action;