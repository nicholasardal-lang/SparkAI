import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  avatarColor: text("avatar_color").notNull().default("violet"),
  password: text("password").notNull(),
  salt: text("salt").notNull(),
  legalVersion: text("legal_version"),
  legalAcceptedAt: integer("legal_accepted_at"),
  emailVerifiedAt: integer("email_verified_at"),
  emailVerificationRequired: integer("email_verification_required").notNull().default(0),
  workspaceEnabled: integer("workspace_enabled").notNull().default(0),
});
// Claims deliberately survive username changes and account deletion.
export const usernameClaims = sqliteTable("username_claims", {
  username: text("username").primaryKey(),
  userId: text("user_id").notNull(),
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
export const conversationMemory=sqliteTable('conversation_memory',{
  projectId:text('project_id').primaryKey().references(()=>projects.id,{onDelete:'cascade'}),
  summary:text('summary').notNull().default(''),
  throughId:text('through_id').notNull().default(''),
  throughCreated:integer('through_created').notNull().default(0),
  task:text('task').notNull().default('{}'),
  updated:integer('updated').notNull(),
});
export const projectAssets = sqliteTable("project_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  specJson: text("spec_json").notNull(),
  created: integer("created").notNull(),
}, (t) => [index("idx_project_assets_created").on(t.projectId, t.created)]);
export const sceneJobs = sqliteTable("scene_jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["queued", "running", "complete", "failed"] }).notNull(),
  planJson: text("plan_json"),
  assetsJson: text("assets_json").notNull().default("[]"),
  error: text("error"),
  leaseToken: text("lease_token"),
  created: integer("created").notNull(),
  updated: integer("updated").notNull(),
}, (t) => [
  index("idx_scene_jobs_project_created").on(t.projectId, t.created),
  check("scene_jobs_status_check", sql`${t.status} IN ('queued','running','complete','failed')`),
]);
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
  paidUntil: integer("paid_until"),
  periodStart: integer("period_start"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
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
export const creditBuckets=sqliteTable("credit_buckets",{
  id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  remaining:integer("remaining").notNull(),expires:integer("expires"),source:text("source").notNull(),
},t=>[index("credit_buckets_user").on(t.userId)]);
export const creditLocks=sqliteTable("credit_locks",{
  userId:text("user_id").primaryKey().references(()=>users.id,{onDelete:"cascade"}),requestId:text("request_id").notNull(),
  expires:integer("expires").notNull(),parts:text("parts").notNull().default("[]"),
});
export const authTokens=sqliteTable("auth_tokens",{
  tokenHash:text("token_hash").primaryKey(),
  userId:text("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  purpose:text("purpose").notNull(),expires:integer("expires").notNull(),createdAt:integer("created_at").notNull(),usedAt:integer("used_at"),
},t=>[index("auth_tokens_user_purpose").on(t.userId,t.purpose,t.expires)]);
