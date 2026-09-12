import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const systemMapState = sqliteTable('system_map_state', {
  id: integer('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});
