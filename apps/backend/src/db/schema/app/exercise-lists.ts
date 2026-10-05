import { relations, sql } from 'drizzle-orm';
import { check, integer, pgTable, real, serial, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { exerciseLogs, exercises } from './exercises';
import { user } from './user';

// Exercise Lists
// An ordered, named list of exercises owned by a user. Doubles as a favorite
// list (no prescriptions) and as a program routine (prescriptions filled in) —
// deliberately no `kind` column, since both are derivable from the data.
export const exerciseLists = pgTable('exercise_lists', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    // Set when someone else (trainer) created it; equals userId for self-made
    // lists. Nullable so Phase 5 sharing needs no migration.
    authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    // Ordering in the UI, and the order the freeze walks when over the cap.
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
},
    (table) => [
        uniqueIndex('exercise_lists_user_name_uq').on(table.userId, table.name),
        // Names are stored trimmed; no description is NULL, never a blank string.
        check('exercise_lists_name_trimmed', sql`${table.name} = btrim(${table.name}) AND ${table.name} <> ''`),
        check('exercise_lists_description_not_blank', sql`${table.description} IS NULL OR btrim(${table.description}) <> ''`),
    ]
);

// Exercise List Items
// Surrogate PK rather than (listId, exerciseId): routines legitimately repeat
// the same exercise (top set + backoff, circuits flattened into one order).
export const exerciseListItems = pgTable('exercise_list_items', {
    id: serial('id').primaryKey(),
    listId: integer('list_id')
        .references(() => exerciseLists.id, { onDelete: 'cascade' })
        .notNull(),
    exerciseId: integer('exercise_id')
        .references(() => exercises.id, { onDelete: 'cascade' })
        .notNull(),
    position: integer('position').notNull(),

    // Prescription — all nullable. Casual favorite lists leave every one null.
    // Weights are kg and distances km, like the sets they pre-fill; the clients
    // convert for display, as they do for sets.
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
    targetWeight: real('target_weight'), // kg
    targetDuration: integer('target_duration'), // seconds
    targetDistance: real('target_distance'), // km
    restSeconds: integer('rest_seconds'),
    notes: text('notes'),
},
    (table) => [
        // Migration 0006 makes it DEFERRABLE, but a pushed schema (tests) isn't, so
        // writes must never pass through a duplicate: PUT /:id/items parks the
        // kept rows on negative positions first.
        unique('exercise_list_items_list_position_uq').on(table.listId, table.position),
        // A target is positive or not prescribed (null); rest may be zero. The upper bounds
        // live in the route's schema.
        check('exercise_list_items_prescription_positive', sql`(${table.targetSets} IS NULL OR ${table.targetSets} >= 1)
            AND (${table.targetReps} IS NULL OR ${table.targetReps} >= 1)
            AND (${table.targetWeight} IS NULL OR ${table.targetWeight} > 0)
            AND (${table.targetDuration} IS NULL OR ${table.targetDuration} >= 1)
            AND (${table.targetDistance} IS NULL OR ${table.targetDistance} > 0)
            AND (${table.restSeconds} IS NULL OR ${table.restSeconds} BETWEEN 0 AND 3600)`),
        check('exercise_list_items_notes_not_blank', sql`${table.notes} IS NULL OR btrim(${table.notes}) <> ''`),
    ]
);

// No `owner`/`author` relations to `user`: both FKs point at the same table, so
// pairing them would need matching relationNames on the user side, and nothing
// traverses that direction yet. Phase 5 (trainer authorship) can add both halves
// together.
export const exerciseListsRelations = relations(exerciseLists, ({ many }) => ({
    items: many(exerciseListItems),
}));

export const exerciseListItemsRelations = relations(exerciseListItems, ({ one, many }) => ({
    list: one(exerciseLists, {
        fields: [exerciseListItems.listId],
        references: [exerciseLists.id],
    }),
    exercise: one(exercises, {
        fields: [exerciseListItems.exerciseId],
        references: [exercises.id],
    }),
    // Logs that were performed from this item — the provenance join that makes
    // the queue cursor exact and Phase 4 adherence reporting possible.
    exerciseLogs: many(exerciseLogs),
}));
