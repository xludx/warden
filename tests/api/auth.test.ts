import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  apiBaseUrl,
  authHeaders,
  cleanupApiTestApplications,
  cleanupApiTestUsers,
  requestJson,
  seedAdminAuth,
  uniqueSlug,
} from "../helpers/api-test-context";

let adminToken: string;
let app: { id: string; slug: string };

beforeAll(async () => {
  const health = await fetch(`${apiBaseUrl}/`).catch((error) => {
    throw new Error(`API is not reachable at ${apiBaseUrl}. Start it with: docker compose up -d --build api db. ${error}`);
  });
  if (!health.ok) throw new Error(`API health check failed at ${apiBaseUrl}: ${health.status}`);

  await cleanupApiTestUsers(["auth"]);
  await cleanupApiTestApplications(["auth"]);
  adminToken = await seedAdminAuth();

  const slug = uniqueSlug("auth");
  const created = await requestJson("/api/admin/applications", {
    method: "POST",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ name: "API Test Auth App", slug }),
  });
  expect(created.response.status).toBe(201);
  app = (created.json as { data: { id: string; slug: string } }).data;
});

afterAll(async () => {
  await cleanupApiTestUsers(["auth"]);
  await cleanupApiTestApplications(["auth"]);
});

describe("auth API", () => {
  test("logs in an admin and returns a token that can access protected routes", async () => {
    const login = await requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "api-test-admin@warden.local", password: "api-test-admin-password", appId: "warden" }),
    });

    expect(login.response.status).toBe(200);
    expect(login.response.headers.get("content-type")).toContain("application/json");
    expect(login.json).toMatchObject({
      success: true,
      data: { user: { email: "api-test-admin@warden.local", name: "API Test Admin" } },
    });

    const token = (login.json as { data: { token: string } }).data.token;
    expect(token).toBeTruthy();

    const me = await requestJson("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.response.status).toBe(200);
    expect(me.json).toMatchObject({ success: true, data: { name: "API Test Admin" } });

    const admin = await requestJson("/api/admin/applications", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(admin.response.status).toBe(200);
    expect(admin.json).toMatchObject({ success: true });
  });

  test("rejects invalid login credentials with 400 JSON", async () => {
    const { response, json } = await requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "api-test-admin@warden.local", password: "wrong-password", appId: "warden" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({ success: false, error: "Invalid email or password" });
  });

  test("rejects invalid bearer tokens with 401 JSON", async () => {
    const { response, json } = await requestJson("/api/auth/me", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({ success: false, error: "Invalid or expired token" });
  });

  test("does not allow non-Warden application tokens to access admin routes", async () => {
    const email = `api-test-auth-${Date.now()}@warden.local`;
    const registered = await requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "API Test auth user", email, password: "api-test-password", appId: app.id }),
    });

    expect(registered.response.status).toBe(201);
    const token = (registered.json as { data: { token: string } }).data.token;

    const { response, json } = await requestJson("/api/admin/applications", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json).toMatchObject({ success: false, error: "Not authorized for warden admin" });
  });
});
