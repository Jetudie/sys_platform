import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const systemMapState = sqliteTable('system_map_state', {
  id: integer('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const accessMembers = sqliteTable('access_members', {
  email: text('email').primaryKey(),
  userId: text('user_id'),
  displayName: text('display_name'),
  role: text('role').notNull().default('viewer'),
  viewDetails: integer('view_details').notNull().default(1),
  viewTopics: integer('view_topics').notNull().default(0),
  viewSpaces: integer('view_spaces').notNull().default(0),
  viewFlows: integer('view_flows').notNull().default(1),
  canEdit: integer('can_edit').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
