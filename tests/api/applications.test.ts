import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import {
  apiBaseUrl,
  authHeaders,
  cleanupApiTestApplications,
  findAuditEvent,
  requestJson,
  seedAdminAuth,
  uniqueSlug,
} from "../helpers/api-test-context";

let token: string;

beforeAll(async () => {
  const health = await fetch(`${apiBaseUrl}/`).catch((error) => {
    throw new Error(`API is not reachable at ${apiBaseUrl}. Start it with: docker compose up -d --build api db. ${error}`);
  });

  if (!health.ok) {
    throw new Error(`API health check failed at ${apiBaseUrl}: ${health.status}`);
  }

  await cleanupApiTestApplications(["create", "duplicate", "delete", "no-auth"]);
  token = await seedAdminAuth();
});

afterAll(async () => {
  await cleanupApiTestApplications(["create", "duplicate", "delete", "no-auth"]);
});

describe("admin applications API", () => {
  test("creates an application, returns 201 JSON, persists it, and writes audit", async () => {
    const slug = uniqueSlug("create");
    const { response, json } = await requestJson("/api/admin/applications", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "API Test Create", slug }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({
      success: true,
      data: {
        name: "API Test Create",
        slug,
      },
    });

    const appId = (json as { data: { id: string } }).data.id;
    const rows = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe(slug);

    const audit = await findAuditEvent("application.created", appId);
    expect(audit).not.toBeNull();
    expect(audit?.actorName).toBe("API Test Admin");
    expect(audit?.targetName).toBe("API Test Create");
  });

  test("rejects duplicate application slugs with 409 JSON", async () => {
    const slug = uniqueSlug("duplicate");

    const first = await requestJson("/api/admin/applications", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "API Test Duplicate", slug }),
    });
    expect(first.response.status).toBe(201);

    const duplicate = await requestJson("/api/admin/applications", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "API Test Duplicate Again", slug }),
    });

    expect(duplicate.response.status).toBe(409);
    expect(duplicate.response.headers.get("content-type")).toContain("application/json");
    expect(duplicate.json).toMatchObject({
      success: false,
      error: `Application slug '${slug}' already taken`,
    });
  });

  test("rejects invalid application payloads with 400 JSON", async () => {
    const { response, json } = await requestJson("/api/admin/applications", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "Invalid Slug", slug: "Invalid Slug" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({ success: false });
  });

  test("deletes an application, returns 200 JSON, removes it, and writes audit", async () => {
    const slug = uniqueSlug("delete");
    const created = await requestJson("/api/admin/applications", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ name: "API Test Delete", slug }),
    });

    expect(created.response.status).toBe(201);
    const appId = (created.json as { data: { id: string } }).data.id;

    const deleted = await requestJson(`/api/admin/applications/${appId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(deleted.response.status).toBe(200);
    expect(deleted.response.headers.get("content-type")).toContain("application/json");
    expect(deleted.json).toEqual({ success: true, data: { deleted: true } });

    const rows = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
    expect(rows).toHaveLength(0);

    const audit = await findAuditEvent("application.deleted", appId);
    expect(audit).not.toBeNull();
    expect(audit?.actorName).toBe("API Test Admin");
    expect(audit?.targetName).toBe("API Test Delete");
  });

  test("does not allow deleting the Warden control-plane application", async () => {
    const listed = await requestJson("/api/admin/applications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const wardenApp = (listed.json as { data: { id: string; slug: string }[] }).data.find((app) => app.slug === "warden");
    expect(wardenApp).toBeDefined();

    const { response, json } = await requestJson(`/api/admin/applications/${wardenApp!.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({
      success: false,
      error: "The Warden control-plane application cannot be deleted",
    });
  });

  test("returns 404 JSON when deleting an unknown application", async () => {
    const { response, json } = await requestJson("/api/admin/applications/missing-application", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({
      success: false,
      error: "Application 'missing-application' not found",
    });
  });

  test("requires an admin bearer token", async () => {
    const { response, json } = await requestJson("/api/admin/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No Auth", slug: uniqueSlug("no-auth") }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({
      success: false,
      error: "Admin access requires Bearer token",
    });
  });
});
