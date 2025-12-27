import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const senderEnum = pgEnum("sender", ["user", "ai"]);

export const conversations = pgTable("conversations", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: senderEnum("sender").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_conversation_created_at_idx").on(
      t.conversationId,
      t.createdAt,
    ),
],
);