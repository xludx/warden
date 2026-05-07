import { pgTable, text, timestamp, varchar, jsonb, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────

export const userTypeEnum = pgEnum("user_type", ["human", "service"]);
export const credentialTypeEnum = pgEnum("credential_type", ["password", "oauth", "passkey"]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "github"]);
// membership_role was previously a pgEnum — now a free-form varchar so each application can define its own roles

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: varchar("id", { length: 21 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  type: userTypeEnum("type").notNull().default("human"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

// ── Credentials (one user → many auth methods) ─────────

export const credentials = pgTable("credentials", {
  id: varchar("id", { length: 21 }).primaryKey(),
  userId: varchar("user_id", { length: 21 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: credentialTypeEnum("type").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  // OAuth: provider_user_id; Passkey: base64(credential_id)
  providerUserId: varchar("provider_user_id", { length: 255 }),
  // password: { password_hash }
  // oauth: { access_token, refresh_token, scopes }
  // passkey: { public_key, counter, transports, aaguid, credential_id }
  credentialData: jsonb("credential_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("credentials_user_idx").on(table.userId),
  index("credentials_provider_idx").on(table.provider, table.providerUserId),
]);

// ── Applications ───────────────────────────────────────

export const applications = pgTable("applications", {
  id: varchar("id", { length: 21 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  jwtSecret: text("jwt_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Memberships (human → app, with role) ───────────────

export const memberships = pgTable("memberships", {
  id: varchar("id", { length: 21 }).primaryKey(),
  userId: varchar("user_id", { length: 21 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  appId: varchar("app_id", { length: 21 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 100 }).notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("memberships_user_idx").on(table.userId),
  index("memberships_app_idx").on(table.appId),
]);

// ── API Keys (works for both humans and services) ──────

export const apiKeys = pgTable("api_keys", {
  id: varchar("id", { length: 21 }).primaryKey(),
  userId: varchar("user_id", { length: 21 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  appId: varchar("app_id", { length: 21 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: varchar("prefix", { length: 12 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (table) => [
  index("api_keys_hash_idx").on(table.keyHash),
]);

// ── OAuth Providers (per-app config) ───────────────────

export const oauthProviders = pgTable("oauth_providers", {
  id: varchar("id", { length: 21 }).primaryKey(),
  appId: varchar("app_id", { length: 21 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  provider: oauthProviderEnum("provider").notNull(),
  clientId: varchar("client_id", { length: 1024 }).notNull(),
  clientSecret: varchar("client_secret", { length: 1024 }).notNull(),
  scopes: text("scopes"),
  redirectUri: text("redirect_uri"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("oauth_providers_app_idx").on(table.appId, table.provider),
]);

// ── Service Grants (which service can access which app) ─

export const serviceGrants = pgTable("service_grants", {
  id: varchar("id", { length: 21 }).primaryKey(),
  serviceUserId: varchar("service_user_id", { length: 21 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetAppId: varchar("target_app_id", { length: 21 })
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  scopes: jsonb("scopes").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("service_grants_service_idx").on(table.serviceUserId),
]);

// ── Audit Events ──────────────────────────────────────

export const auditEvents = pgTable("audit_events", {
  id: varchar("id", { length: 21 }).primaryKey(),
  action: varchar("action", { length: 100 }).notNull(), // user.registered, user.login, api_key.created, etc.
  actorId: varchar("actor_id", { length: 21 }), // who did it (null for system)
  actorType: varchar("actor_type", { length: 20 }), // "human" | "service" | "system"
  actorName: varchar("actor_name", { length: 255 }),
  targetType: varchar("target_type", { length: 50 }), // "user", "application", "api_key", "membership", "service_grant"
  targetId: varchar("target_id", { length: 21 }),
  targetName: varchar("target_name", { length: 255 }),
  appId: varchar("app_id", { length: 21 }), // which app was involved
  metadata: jsonb("metadata"), // arbitrary extra data
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_events_action_idx").on(table.action),
  index("audit_events_actor_idx").on(table.actorId),
  index("audit_events_target_idx").on(table.targetType, table.targetId),
  index("audit_events_app_idx").on(table.appId),
  index("audit_events_created_idx").on(table.createdAt),
]);

// ── Passkey Challenges (ephemeral) ─────────────────────

export const passkeyChallenges = pgTable("passkey_challenges", {
  id: varchar("id", { length: 21 }).primaryKey(),
  userId: varchar("user_id", { length: 21 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // "registration" | "authentication"
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
