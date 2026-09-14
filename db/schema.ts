import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  salt: text("salt").notNull(),
  legalVersion: text("legal_version"),
  legalAcceptedAt: integer("legal_accepted_at"),
  workspaceEnabled: integer("workspace_enabled").notNull().default(0),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires").notNull(),
});
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    updated: integer("updated").notNull(),
    busyUntil: integer("busy_until").notNull().default(0),
  },
  (t) => [index("idx_projects_owner_updated").on(t.userId, t.updated)],
);
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    created: integer("created").notNull(),
  },
  (t) => [index("idx_messages_project_created").on(t.projectId, t.created)],
);
export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  state: text("state").notNull(),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  created: integer("created").notNull(),
});
export const limits = sqliteTable("limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
});
export const stripeEvents = sqliteTable("stripe_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: integer("processed_at").notNull(),
});
export const billingAccounts = sqliteTable("billing_accounts", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  planId: text("plan_id"),
  billingPeriod: text("billing_period"),
  subscriptionStatus: text("subscription_status"),
  updatedAt: integer("updated_at").notNull(),
});
export const creditLedger = sqliteTable("credit_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  source: text("source").notNull(),
  stripeReference: text("stripe_reference").unique(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("idx_credit_ledger_user_created").on(t.userId, t.createdAt)]);
