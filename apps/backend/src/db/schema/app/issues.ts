import { relations } from "drizzle-orm";
import { pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./user";

export const issueTypeEnum = pgEnum('issue_type', ['bug', 'feedback']);
export const issueStatusEnum = pgEnum('issue_status', ['open', 'resolved', 'closed']);

export const issues = pgTable('issues', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    type: issueTypeEnum('type').notNull().default('bug'),
    title: varchar('title', { length: 255 }),
    path: text('path'),
    description: text('description').notNull(),
    stackTrace: text('stack_trace'),
    status: issueStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const issuesRelations = relations(issues, ({ one }) => ({
    user: one(user, { fields: [issues.userId], references: [user.id] }),
}));
