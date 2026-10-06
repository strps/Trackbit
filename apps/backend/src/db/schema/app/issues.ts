import { relations, sql } from "drizzle-orm";
import { check, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./user";

export const issueTypeEnum = pgEnum('issue_type', ['bug', 'feedback']);
export const issueStatusEnum = pgEnum('issue_status', ['open', 'resolved', 'closed']);

export const issues = pgTable('issues', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    type: issueTypeEnum('type').notNull().default('bug'),
    title: varchar('title', { length: 255 }),
    // Where the report was sent from: the web's route, or null.
    path: text('path'),
    // What sent it: the web's user agent, or the app's version and device.
    client: varchar('client', { length: 255 }),
    description: text('description').notNull(),
    stackTrace: text('stack_trace'),
    status: issueStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
},
    (table) => [
        // Text is stored trimmed by the route; nothing optional is a blank string.
        check('issues_description_not_blank', sql`btrim(${table.description}) <> ''`),
        check('issues_optional_not_blank', sql`(${table.title} IS NULL OR btrim(${table.title}) <> '')
            AND (${table.path} IS NULL OR btrim(${table.path}) <> '')
            AND (${table.client} IS NULL OR btrim(${table.client}) <> '')
            AND (${table.stackTrace} IS NULL OR btrim(${table.stackTrace}) <> '')`),
    ]
);

export const issuesRelations = relations(issues, ({ one }) => ({
    user: one(user, { fields: [issues.userId], references: [user.id] }),
}));
