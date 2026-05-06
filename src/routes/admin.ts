import { Elysia } from "elysia";
import { errorHandlerMiddleware } from "@/middleware/error-handler";
import { requestIdMiddleware } from "@/middleware/request-id";
import { wardenAdminMiddleware } from "@/middleware/auth";
import { adminService } from "@/services/AdminService";
import {
  CreateApplicationSchema,
  AddMembershipSchema,
  RemoveMembershipSchema,
  CreateServiceAccountSchema,
  AddServiceGrantSchema,
  IdParamSchema,
} from "@/routes/schema/admin-schema";
import { successResponse, listResponse } from "@/util/response-helpers";

const validateId = (params: Record<string, string>) => {
  const parsed = IdParamSchema.safeParse(params);
  return parsed.success ? parsed.data.id : null;
};

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(requestIdMiddleware)
  .use(errorHandlerMiddleware)
  .use(wardenAdminMiddleware)

  // ── Applications ────────────────────────────────

  .post(
    "/applications",
    async ({ body, set }) => {
      const app = await adminService.createApplication(body.name, body.slug);
      set.status = 201;
      return successResponse(app);
    },
    {
      body: CreateApplicationSchema,
      detail: { tags: ["Admin"], summary: "Create an application" },
    }
  )

  .get(
    "/applications",
    async () => {
      const apps = await adminService.listApplications();
      return listResponse(apps);
    },
    { detail: { tags: ["Admin"], summary: "List applications" } }
  )

  .get(
    "/applications/:id",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const app = await adminService.getApplication(id);
      return successResponse(app);
    },
    { detail: { tags: ["Admin"], summary: "Get an application" } }
  )

  .delete(
    "/applications/:id",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.deleteApplication(id);
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Delete an application" } }
  )

  .post(
    "/applications/:id/rotate-secret",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const app = await adminService.rotateAppSecret(id);
      return successResponse(app);
    },
    { detail: { tags: ["Admin"], summary: "Rotate application JWT secret" } }
  )

  // ── Users ───────────────────────────────────────

  .get(
    "/users",
    async () => {
      const users = await adminService.listUsers();
      return listResponse(users);
    },
    { detail: { tags: ["Admin"], summary: "List users" } }
  )

  .get(
    "/users/:id",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const user = await adminService.getUser(id);
      return successResponse(user);
    },
    { detail: { tags: ["Admin"], summary: "Get a user" } }
  )

  .delete(
    "/users/:id",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.deleteUser(id);
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Delete a user" } }
  )

  .get(
    "/users/:id/memberships",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const memberships = await adminService.listUserMemberships(id);
      return successResponse(memberships);
    },
    { detail: { tags: ["Admin"], summary: "List user memberships" } }
  )

  .post(
    "/users/:id/memberships",
    async ({ params, body, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.addMembership(id, body.appId, body.role);
      return successResponse({ added: true });
    },
    {
      body: AddMembershipSchema,
      detail: { tags: ["Admin"], summary: "Add user to an application" },
    }
  )

  .delete(
    "/users/:id/memberships",
    async ({ params, body, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.removeMembership(id, body.appId);
      return successResponse({ removed: true });
    },
    {
      body: RemoveMembershipSchema,
      detail: { tags: ["Admin"], summary: "Remove user from an application" },
    }
  )

  // ── Service Accounts ────────────────────────────

  .post(
    "/service-accounts",
    async ({ body, set }) => {
      const result = await adminService.createServiceAccount(body.name, body.appId);
      set.status = 201;
      return successResponse(result);
    },
    {
      body: CreateServiceAccountSchema,
      detail: { tags: ["Admin"], summary: "Create a service account" },
    }
  )

  .get(
    "/service-accounts",
    async () => {
      const accounts = await adminService.listServiceAccounts();
      return listResponse(accounts);
    },
    { detail: { tags: ["Admin"], summary: "List service accounts" } }
  )

  .delete(
    "/service-accounts/:id",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.deleteServiceAccount(id);
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Delete a service account" } }
  )

  // ── Service Grants ──────────────────────────────

  .post(
    "/service-accounts/:id/grants",
    async ({ params, body, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const grant = await adminService.addServiceGrant(id, body.targetAppId, body.scopes);
      return successResponse(grant);
    },
    {
      body: AddServiceGrantSchema,
      detail: { tags: ["Admin"], summary: "Add a service grant" },
    }
  )

  .get(
    "/service-accounts/:id/grants",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const grants = await adminService.listServiceGrants(id);
      return listResponse(grants);
    },
    { detail: { tags: ["Admin"], summary: "List service grants" } }
  )

  .delete(
    "/service-accounts/:id/grants/:grantId",
    async ({ params, set }) => {
      const { id, grantId } = params as { id: string; grantId: string };
      if (!id || !grantId) { set.status = 400; return { success: false, error: "Invalid parameters" }; }
      await adminService.removeServiceGrant(grantId);
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Remove a service grant" } }
  )

  // ── API Keys (admin view) ───────────────────────

  .get(
    "/api-keys",
    async () => {
      const keys = await adminService.listAllApiKeys();
      return listResponse(keys);
    },
    { detail: { tags: ["Admin"], summary: "List all API keys" } }
  )

  .delete(
    "/api-keys/:id",
    async ({ params, set }) => {
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.adminDeleteApiKey(id);
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Revoke any API key" } }
  );
