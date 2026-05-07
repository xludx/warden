import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import {
  apiBaseUrl,
  cleanupApiTestApiKeys,
  findAuditEvent,
  requestJson,
  seedAdminAuth,
} from "../helpers/api-test-context";

let token: string;
let wardenAppId: string;

beforeAll(async () => {
  const health = await fetch(`${apiBaseUrl}/`).catch((error) => {
    throw new Error(`API is not reachable at ${apiBaseUrl}. Start it with: docker compose up -d --build api db. ${error}`);
  });
  if (!health.ok) throw new Error(`API health check failed at ${apiBaseUrl}: ${health.status}`);

  await cleanupApiTestApiKeys(["key", "admin-key"]);
  token = await seedAdminAuth();

  const apps = await requestJson("/api/admin/applications", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const warden = (apps.json as { data: { id: string; slug: string }[] }).data.find((app) => app.slug === "warden");
  expect(warden).toBeDefined();
  wardenAppId = warden!.id;
});

afterAll(async () => {
  await cleanupApiTestApiKeys(["key", "admin-key"]);
});

describe("API keys API", () => {
  test("creates, lists, verifies, and revokes a user API key", async () => {
    const created = await requestJson("/api/auth/api-keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "API Test key lifecycle", appId: wardenAppId }),
    });

    expect(created.response.status).toBe(201);
    expect(created.response.headers.get("content-type")).toContain("application/json");
    expect(created.json).toMatchObject({ success: true, data: { name: "API Test key lifecycle" } });

    const keyData = (created.json as { data: { id: string; key: string; prefix: string } }).data;
    expect(keyData.key).toBeTruthy();
    expect(keyData.prefix).toBe(keyData.key.slice(0, 12));

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, keyData.id)).limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).not.toBe(keyData.key);

    const listed = await requestJson("/api/auth/api-keys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.response.status).toBe(200);
    expect((listed.json as { data: { id: string }[] }).data.some((key) => key.id === keyData.id)).toBe(true);

    const verified = await requestJson("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: keyData.key }),
    });
    expect(verified.response.status).toBe(200);
    expect(verified.json).toMatchObject({ success: true, data: { app: { slug: "warden" }, scopes: [] } });

    const audit = await findAuditEvent("api_key.created", keyData.id);
    expect(audit).not.toBeNull();
    expect(audit?.targetName).toBe("API Test key lifecycle");

    const deleted = await requestJson(`/api/auth/api-keys/${keyData.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleted.response.status).toBe(200);
    expect(deleted.json).toEqual({ success: true, data: { deleted: true } });

    const afterDeleteRows = await db.select().from(apiKeys).where(eq(apiKeys.id, keyData.id)).limit(1);
    expect(afterDeleteRows).toHaveLength(0);

    const verifyDeleted = await requestJson("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: keyData.key }),
    });
    expect(verifyDeleted.response.status).toBe(400);
    expect(verifyDeleted.json).toMatchObject({ success: false, error: "Invalid API key" });
  });

  test("admin can list and revoke any API key", async () => {
    const created = await requestJson("/api/auth/api-keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "API Test admin-key revoke", appId: wardenAppId }),
    });
    expect(created.response.status).toBe(201);
    const keyId = (created.json as { data: { id: string } }).data.id;

    const listed = await requestJson("/api/admin/api-keys", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.response.status).toBe(200);
    expect((listed.json as { data: { id: string }[] }).data.some((key) => key.id === keyId)).toBe(true);

    const revoked = await requestJson(`/api/admin/api-keys/${keyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(revoked.response.status).toBe(200);
    expect(revoked.json).toEqual({ success: true, data: { deleted: true } });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
    expect(rows).toHaveLength(0);

    const audit = await findAuditEvent("api_key.revoked", keyId);
    expect(audit).not.toBeNull();
  });

  test("returns 404 JSON when revoking an unknown API key", async () => {
    const { response, json } = await requestJson("/api/admin/api-keys/missing-key", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({ success: false, error: "API key 'missing-key' not found" });
  });
});
