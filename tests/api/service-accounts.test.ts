import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceGrants, users } from "@/db/schema";
import {
  apiBaseUrl,
  authHeaders,
  cleanupApiTestApplications,
  cleanupApiTestUsers,
  findAuditEvent,
  requestJson,
  seedAdminAuth,
  uniqueSlug,
} from "../helpers/api-test-context";

let token: string;
let sourceApp: { id: string; slug: string };
let targetApp: { id: string; slug: string };

async function createApplication(name: string, label: string) {
  const slug = uniqueSlug(label);
  const created = await requestJson("/api/admin/applications", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, slug }),
  });
  expect(created.response.status).toBe(201);
  return (created.json as { data: { id: string; slug: string } }).data;
}

beforeAll(async () => {
  const health = await fetch(`${apiBaseUrl}/`).catch((error) => {
    throw new Error(`API is not reachable at ${apiBaseUrl}. Start it with: docker compose up -d --build api db. ${error}`);
  });
  if (!health.ok) throw new Error(`API health check failed at ${apiBaseUrl}: ${health.status}`);

  await cleanupApiTestUsers(["service"]);
  await cleanupApiTestApplications(["service-source", "service-target"]);
  token = await seedAdminAuth();
  sourceApp = await createApplication("API Test Service Source", "service-source");
  targetApp = await createApplication("API Test Service Target", "service-target");
});

afterAll(async () => {
  await cleanupApiTestUsers(["service"]);
  await cleanupApiTestApplications(["service-source", "service-target"]);
});

describe("admin service accounts and service grants API", () => {
  test("creates, lists, and deletes a service account with audit events", async () => {
    const created = await requestJson("/api/admin/service-accounts", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "API Test service account lifecycle", appId: sourceApp.id }),
    });

    expect(created.response.status).toBe(201);
    expect(created.response.headers.get("content-type")).toContain("application/json");
    expect(created.json).toMatchObject({
      success: true,
      data: { user: { name: "API Test service account lifecycle", type: "service" } },
    });

    const serviceUser = (created.json as { data: { user: { id: string }; clientId: string; clientSecret: string } }).data;
    expect(serviceUser.clientId).toBe(serviceUser.user.id);
    expect(serviceUser.clientSecret).toBeTruthy();

    const listed = await requestJson("/api/admin/service-accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.response.status).toBe(200);
    expect((listed.json as { data: { id: string }[] }).data.some((user) => user.id === serviceUser.user.id)).toBe(true);

    const createdAudit = await findAuditEvent("service_account.created", serviceUser.user.id);
    expect(createdAudit).not.toBeNull();

    const deleted = await requestJson(`/api/admin/service-accounts/${serviceUser.user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleted.response.status).toBe(200);
    expect(deleted.json).toEqual({ success: true, data: { deleted: true } });

    const rows = await db.select().from(users).where(eq(users.id, serviceUser.user.id)).limit(1);
    expect(rows).toHaveLength(0);

    const deletedAudit = await findAuditEvent("service_account.deleted", serviceUser.user.id);
    expect(deletedAudit).not.toBeNull();
  });

  test("adds, lists, removes service grants and supports client credentials tokens", async () => {
    const created = await requestJson("/api/admin/service-accounts", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "API Test service account grants", appId: sourceApp.id }),
    });
    expect(created.response.status).toBe(201);
    const serviceAccount = (created.json as { data: { user: { id: string }; clientId: string; clientSecret: string } }).data;

    const grant = await requestJson(`/api/admin/service-accounts/${serviceAccount.user.id}/grants`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ targetAppId: targetApp.id, scopes: ["read:things", "write:things"] }),
    });

    expect(grant.response.status).toBe(200);
    expect(grant.json).toMatchObject({
      success: true,
      data: { serviceUserId: serviceAccount.user.id, targetAppId: targetApp.id, scopes: ["read:things", "write:things"] },
    });
    const grantId = (grant.json as { data: { id: string } }).data.id;

    const grantRows = await db.select().from(serviceGrants).where(eq(serviceGrants.id, grantId)).limit(1);
    expect(grantRows).toHaveLength(1);

    const listed = await requestJson(`/api/admin/service-accounts/${serviceAccount.user.id}/grants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.response.status).toBe(200);
    expect((listed.json as { data: { id: string }[] }).data.some((item) => item.id === grantId)).toBe(true);

    const issuedToken = await requestJson("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: serviceAccount.clientId,
        client_secret: serviceAccount.clientSecret,
        grant_type: "client_credentials",
        audience: targetApp.slug,
      }),
    });
    expect(issuedToken.response.status).toBe(200);
    expect(issuedToken.json).toMatchObject({ success: true, data: { token_type: "Bearer", expires_in: 3600 } });
    expect((issuedToken.json as { data: { access_token: string } }).data.access_token).toBeTruthy();

    const tokenAudit = await findAuditEvent("token.client_credentials", targetApp.id);
    expect(tokenAudit).not.toBeNull();

    const removed = await requestJson(`/api/admin/service-accounts/${serviceAccount.user.id}/grants/${grantId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(removed.response.status).toBe(200);
    expect(removed.json).toEqual({ success: true, data: { deleted: true } });

    const removedRows = await db.select().from(serviceGrants).where(eq(serviceGrants.id, grantId)).limit(1);
    expect(removedRows).toHaveLength(0);

    const deniedToken = await requestJson("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: serviceAccount.clientId,
        client_secret: serviceAccount.clientSecret,
        grant_type: "client_credentials",
        audience: targetApp.slug,
      }),
    });
    expect(deniedToken.response.status).toBe(403);
    expect(deniedToken.json).toMatchObject({ success: false });
  });

  test("rejects grants for unknown service accounts with 404 JSON", async () => {
    const { response, json } = await requestJson("/api/admin/service-accounts/missing-service/grants", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ targetAppId: targetApp.id, scopes: ["read:things"] }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({ success: false, error: "User 'missing-service' not found" });
  });
});
