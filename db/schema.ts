import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
export const vault = pgTable('vault_collections', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
})

export const members = pgTable('vault_members', {
  id: text().primaryKey(),
  name: text().notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
})
export const sessions = pgTable('vault_presence', {
  id: text().primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow().notNull(),
})
