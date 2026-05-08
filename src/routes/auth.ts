import { Elysia } from "elysia";
import { errorHandlerMiddleware } from "@/middleware/error-handler";
import { requestIdMiddleware } from "@/middleware/request-id";
import { authMiddleware, requireAuth } from "@/middleware/auth";
import { authService } from "@/services/AuthService";
import {
  RegisterSchema,
  LoginSchema,
  CreateApiKeySchema,
  VerifySchema,
  IdParamSchema,
} from "@/routes/schema/auth-schema";
import { successResponse } from "@/util/response-helpers";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(requestIdMiddleware)
  .use(errorHandlerMiddleware)

  // ── Public ──────────────────────────────────────

  .post(
    "/register",
    async ({ body, set }) => {
      const result = await authService.register(body);
      set.status = 201;
      return successResponse(result);
    },
    {
      body: RegisterSchema,
      detail: { tags: ["Auth"], summary: "Register a new user" },
    }
  )

  .post(
    "/login",
    async ({ body }) => {
      const result = await authService.login(body.email, body.password, body.appId);
      return successResponse(result);
    },
    {
      body: LoginSchema,
      detail: { tags: ["Auth"], summary: "Login with email and password" },
    }
  )



  .post(
    "/verify",
    async ({ body }) => {
      const result = await authService.verify(body.apiKey);
      return successResponse(result);
    },
    {
      body: VerifySchema,
      detail: { tags: ["Auth"], summary: "Verify an API key (for other backends)" },
    }
  )

  // ── Protected ───────────────────────────────────

  .use(authMiddleware)

  .get(
    "/me",
    async ({ headers }) => {
      const { user } = await requireAuth(headers);
      const fullUser = await authService.getUser(user.id);
      return successResponse(fullUser);
    },
    { detail: { tags: ["Auth"], summary: "Get current user" } }
  )

  .post(
    "/api-keys",
    async ({ headers, body, set }) => {
      const { user } = await requireAuth(headers);
      const result = await authService.createApiKey(user.id, body.appId, body.name);
      set.status = 201;
      return successResponse(result);
    },
    {
      body: CreateApiKeySchema,
      detail: { tags: ["Auth"], summary: "Create a new API key" },
    }
  )

  .get(
    "/api-keys",
    async ({ headers }) => {
      const { user, authApp } = await requireAuth(headers);
      const keys = await authService.listApiKeys(user.id, authApp.id);
      return successResponse(keys);
    },
    { detail: { tags: ["Auth"], summary: "List your API keys" } }
  )

  .delete(
    "/api-keys/:id",
    async ({ headers, params, set }) => {
      const { user } = await requireAuth(headers);
      const parsed = IdParamSchema.safeParse(params);
      if (!parsed.success) { set.status = 400; return { success: false, error: "Invalid ID" }; }
      await authService.deleteApiKey(user.id, parsed.data.id);
      return successResponse({ deleted: true });
    },
    { detail: { tags: ["Auth"], summary: "Revoke an API key" } }
  );
