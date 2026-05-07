import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, applications, auditEvents, credentials, memberships, users } from "@/db/schema";

export const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:3210").replace(/\/$/, "");

const adminUserId = "test-admin-user-001";
const adminEmail = "api-test-admin@warden.local";
const adminPassword = "api-test-admin-password";
const fallbackWardenAppId = "test-warden-app-001";
const wardenMembershipId = "test-warden-mem-001";

export async function seedAdminAuth(): Promise<string> {
  await db.insert(applications).values({
    id: fallbackWardenAppId,
    name: "Warden",
    slug: "warden",
    jwtSecret: "test-warden-jwt-secret-at-least-32-characters",
  }).onConflictDoNothing();

  const wardenAppRows = await db.select({ id: applications.id }).from(applications).where(eq(applications.slug, "warden")).limit(1);
  const wardenAppId = wardenAppRows[0].id;

  await db.insert(users).values({
    id: adminUserId,
    email: adminEmail,
    name: "API Test Admin",
    type: "human",
  }).onConflictDoNothing();

  const existingCredential = await db.select({ id: credentials.id }).from(credentials).where(
    and(eq(credentials.userId, adminUserId), eq(credentials.type, "password")),
  ).limit(1);

  if (existingCredential.length === 0) {
    await db.insert(credentials).values({
      id: "test-admin-cred-001",
      userId: adminUserId,
      type: "password",
      provider: "password",
      credentialData: { password_hash: await bcrypt.hash(adminPassword, 4) },
    }).onConflictDoNothing();
  }

  const existingMembership = await db.select({ id: memberships.id }).from(memberships).where(
    and(eq(memberships.userId, adminUserId), eq(memberships.appId, wardenAppId)),
  ).limit(1);

  if (existingMembership.length === 0) {
    await db.insert(memberships).values({
      id: wardenMembershipId,
      userId: adminUserId,
      appId: wardenAppId,
      role: "admin",
    }).onConflictDoNothing();
  }

  const { response, json } = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword, appId: "warden" }),
  });

  if (response.status !== 200) {
    throw new Error(`Could not log in API test admin: ${response.status} ${JSON.stringify(json)}`);
  }

  return (json as { data: { token: string } }).data.token;
}

export async function cleanupApiTestApplications(labels: string[] = ["app"]): Promise<void> {
  for (const label of labels) {
    await db.delete(applications).where(like(applications.slug, `api-test-${label}-%`));
  }
}

export async function cleanupApiTestUsers(labels: string[] = ["user", "service"]): Promise<void> {
  for (const label of labels) {
    await db.delete(users).where(like(users.name, `API Test ${label}%`));
    await db.delete(users).where(like(users.email, `api-test-${label}-%@warden.local`));
  }
}

export async function cleanupApiTestApiKeys(labels: string[] = ["key"]): Promise<void> {
  for (const label of labels) {
    await db.delete(apiKeys).where(like(apiKeys.name, `API Test ${label}%`));
  }
}

export async function findAuditEvent(action: string, targetId: string) {
  const rows = await db.select().from(auditEvents).where(
    and(eq(auditEvents.action, action), eq(auditEvents.targetId, targetId)),
  ).limit(1);

  return rows[0] ?? null;
}

export function uniqueSlug(label = "app"): string {
  return `api-test-${label}-${nanoid(8).toLowerCase().replace(/_/g, "-")}`;
}

export async function requestJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const text = await response.text();
  let json: unknown = null;

  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON from ${path}, got ${response.status} ${response.headers.get("content-type")}: ${text}`);
    }
  }

  return { response, json };
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
