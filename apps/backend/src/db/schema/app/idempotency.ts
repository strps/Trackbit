import { pgTable, text, integer, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { user } from './user';

// Responses to writes sent with an Idempotency-Key, replayed when a client
// (the native outbox) retries a request whose response it never received.
// A row with a null status is a reservation for a request still in flight.
export const idempotencyKeys = pgTable('idempotency_keys',
  {
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    status: integer('status'),
    contentType: text('content_type'),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    index('idempotency_keys_created_at_idx').on(t.createdAt),
  ],
);
