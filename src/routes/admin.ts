import { Elysia } from "elysia";
import { errorHandlerMiddleware } from "@/middleware/error-handler";
import { requestIdMiddleware } from "@/middleware/request-id";
import { requireWardenAdmin, wardenAdminMiddleware } from "@/middleware/auth";
import { adminService } from "@/services/AdminService";
import { auditService } from "@/services/AuditService";
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
    async ({ body, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const app = await adminService.createApplication(body.name, body.slug);
      await auditService.log({ action: "application.created", actorId: user.id, actorType: "human", actorName: user.name, targetType: "application", targetId: app.id, targetName: body.name });
      set.status = 201;
      return successResponse(app);
    },
    {
      body: CreateApplicationSchema,
      detail: { tags: ["Admin"], summary: "Create an application" },
    }
  )

  .get("/applications", async ({ headers }) => {
    await requireWardenAdmin(headers);
    return listResponse(await adminService.listApplications());
  }, { detail: { tags: ["Admin"], summary: "List applications" } })

  .get(
    "/applications/:id",
    async ({ params, headers, set }) => {
      await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      return successResponse(await adminService.getApplication(id));
    },
    { detail: { tags: ["Admin"], summary: "Get an application" } }
  )

  .delete(
    "/applications/:id",
    async ({ params, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const app = await adminService.getApplication(id);
      await adminService.deleteApplication(id);
      await auditService.log({ action: "application.deleted", actorId: user.id, actorType: "human", actorName: user.name, targetType: "application", targetId: id, targetName: app.name, metadata: { slug: app.slug } });
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Delete an application" } }
  )

  .post(
    "/applications/:id/rotate-secret",
    async ({ params, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const app = await adminService.rotateAppSecret(id);
      await auditService.log({ action: "application.secret_rotated", actorId: user.id, actorType: "human", actorName: user.name, targetType: "application", targetId: id, targetName: app.name });
      return successResponse(app);
    },
    { detail: { tags: ["Admin"], summary: "Rotate application JWT secret" } }
  )

  // ── Users ───────────────────────────────────────

  .get("/users", async ({ headers }) => {
    await requireWardenAdmin(headers);
    return listResponse(await adminService.listUsers());
  }, { detail: { tags: ["Admin"], summary: "List users" } })

  .get(
    "/users/:id",
    async ({ params, headers, set }) => {
      await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      return successResponse(await adminService.getUser(id));
    },
    { detail: { tags: ["Admin"], summary: "Get a user" } }
  )

  .delete(
    "/users/:id",
    async ({ params, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.deleteUser(id);
      await auditService.log({ action: "user.deleted", actorId: user.id, actorType: "human", actorName: user.name, targetType: "user", targetId: id });
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Delete a user" } }
  )

  .get("/users/:id/memberships", async ({ params, headers, set }) => {
    await requireWardenAdmin(headers);
    const id = validateId(params);
    if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
    return successResponse(await adminService.listUserMemberships(id));
  }, { detail: { tags: ["Admin"], summary: "List user memberships" } })

  .post(
    "/users/:id/memberships",
    async ({ params, body, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.addMembership(id, body.appId, body.role);
      await auditService.log({ action: "membership.added", actorId: user.id, actorType: "human", actorName: user.name, targetType: "membership", targetId: id, appId: body.appId, metadata: { role: body.role } });
      return successResponse({ added: true });
    },
    { body: AddMembershipSchema, detail: { tags: ["Admin"], summary: "Add user to an application" } }
  )

  .delete(
    "/users/:id/memberships",
    async ({ params, body, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.removeMembership(id, body.appId);
      await auditService.log({ action: "membership.removed", actorId: user.id, actorType: "human", actorName: user.name, targetType: "membership", targetId: id, appId: body.appId });
      return successResponse({ removed: true });
    },
    { body: RemoveMembershipSchema, detail: { tags: ["Admin"], summary: "Remove user from an application" } }
  )

  // ── Service Accounts ────────────────────────────

  .post(
    "/service-accounts",
    async ({ body, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const result = await adminService.createServiceAccount(body.name, body.appId);
      await auditService.log({ action: "service_account.created", actorId: user.id, actorType: "human", actorName: user.name, targetType: "user", targetId: result.user.id, targetName: body.name, appId: body.appId });
      set.status = 201;
      return successResponse(result);
    },
    { body: CreateServiceAccountSchema, detail: { tags: ["Admin"], summary: "Create a service account" } }
  )

  .get("/service-accounts", async ({ headers }) => {
    await requireWardenAdmin(headers);
    return listResponse(await adminService.listServiceAccounts());
  }, { detail: { tags: ["Admin"], summary: "List service accounts" } })

  .delete(
    "/service-accounts/:id",
    async ({ params, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.deleteServiceAccount(id);
      await auditService.log({ action: "service_account.deleted", actorId: user.id, actorType: "human", actorName: user.name, targetType: "user", targetId: id });
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Delete a service account" } }
  )

  // ── Service Grants ──────────────────────────────

  .post(
    "/service-accounts/:id/grants",
    async ({ params, body, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      const grant = await adminService.addServiceGrant(id, body.targetAppId, body.scopes);
      await auditService.log({ action: "service_grant.added", actorId: user.id, actorType: "human", actorName: user.name, targetType: "service_grant", targetId: grant.id, appId: body.targetAppId, metadata: { serviceUserId: id, scopes: body.scopes } });
      return successResponse(grant);
    },
    { body: AddServiceGrantSchema, detail: { tags: ["Admin"], summary: "Add a service grant" } }
  )

  .get(
    "/service-accounts/:id/grants",
    async ({ params, headers, set }) => {
      await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      return listResponse(await adminService.listServiceGrants(id));
    },
    { detail: { tags: ["Admin"], summary: "List service grants" } }
  )

  .delete(
    "/service-accounts/:id/grants/:grantId",
    async ({ params, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const { id, grantId } = params as { id: string; grantId: string };
      if (!id || !grantId) { set.status = 400; return { success: false, error: "Invalid parameters" }; }
      await adminService.removeServiceGrant(grantId);
      await auditService.log({ action: "service_grant.removed", actorId: user.id, actorType: "human", actorName: user.name, targetType: "service_grant", targetId: grantId });
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Remove a service grant" } }
  )

  // ── API Keys (admin view) ───────────────────────

  .get("/api-keys", async ({ headers }) => {
    await requireWardenAdmin(headers);
    return listResponse(await adminService.listAllApiKeys());
  }, { detail: { tags: ["Admin"], summary: "List all API keys" } })

  .delete(
    "/api-keys/:id",
    async ({ params, headers, set }) => {
      const { user } = await requireWardenAdmin(headers);
      const id = validateId(params);
      if (!id) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await adminService.adminDeleteApiKey(id);
      await auditService.log({ action: "api_key.revoked", actorId: user.id, actorType: "human", actorName: user.name, targetType: "api_key", targetId: id });
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Admin"], summary: "Revoke any API key" } }
  )

  // ── Audit Events ────────────────────────────────

  .get(
    "/audit",
    async ({ query, headers }) => {
      await requireWardenAdmin(headers);
      const result = await auditService.list({
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
        action: query.action,
        actorId: query.actorId,
        targetType: query.targetType,
        appId: query.appId,
      });
      return successResponse(result);
    },
    { detail: { tags: ["Admin"], summary: "List audit events" } }
  );
