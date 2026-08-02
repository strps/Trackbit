import { relations } from 'drizzle-orm';
import { integer, pgTable, real, serial, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';
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
    // Units are the exercise's defaultWeightUnit / defaultDistanceUnit; the
    // prescription itself stores no unit.
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
    targetWeight: real('target_weight'),
    targetDuration: integer('target_duration'), // seconds
    targetDistance: real('target_distance'),
    restSeconds: integer('rest_seconds'),
    notes: text('notes'),
},
    (table) => [
        // Enforced as DEFERRABLE INITIALLY DEFERRED in migration 0006 so a
        // reorder can pass through conflicting intermediate positions inside a
        // transaction, exactly like habits_user_anti_order_uq.
        unique('exercise_list_items_list_position_uq').on(table.listId, table.position),
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
