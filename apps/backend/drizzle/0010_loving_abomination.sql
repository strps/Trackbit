-- =============================================
-- Muscle Groups Schema Evolution + Seed Data
-- =============================================

-- 1. Delete all existing records (clean slate)
DELETE FROM "muscle_groups";

--> statement-breakpoint

-- 2. Drop old constraint
ALTER TABLE "muscle_groups" DROP CONSTRAINT IF EXISTS "muscle_groups_name_unique";

--> statement-breakpoint

-- 3. Add new columns
ALTER TABLE "muscle_groups" 
    ADD COLUMN "slug" text NOT NULL,
    ADD COLUMN "parent_id" integer,
    ADD COLUMN "level" integer DEFAULT 1 NOT NULL,
    ADD COLUMN "display_order" integer DEFAULT 0,
    ADD COLUMN "created_at" timestamp DEFAULT now();

--> statement-breakpoint

-- 4. Add Foreign Key (self-referencing)
ALTER TABLE "muscle_groups" 
    ADD CONSTRAINT "muscle_groups_parent_id_muscle_groups_id_fk" 
    FOREIGN KEY ("parent_id") 
    REFERENCES "public"."muscle_groups"("id") 
    ON DELETE SET NULL ON UPDATE NO ACTION;

--> statement-breakpoint

-- 5. Add Unique Constraint on slug
ALTER TABLE "muscle_groups" 
    ADD CONSTRAINT "muscle_groups_slug_unique" 
    UNIQUE("slug");

--> statement-breakpoint
