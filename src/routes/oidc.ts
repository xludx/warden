import { Elysia } from "elysia";
import { z } from "zod";
import { errorHandlerMiddleware } from "@/middleware/error-handler";
import { requestIdMiddleware } from "@/middleware/request-id";
import { authMiddleware, requireAuth } from "@/middleware/auth";
import { logger } from "@/util/logger";
import { oidcService } from "@/services/OidcService";
import { authService } from "@/services/AuthService";
import { successResponse } from "@/util/response-helpers";
import { ValidationError } from "@/errors/service-errors";

// ── Schemas ────────────────────────────────────────────

const AuthorizeSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url().optional(),
  state: z.string().min(1),
});

const AuthorizationCodeGrantSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code: z.string().min(1),
  grant_type: z.literal("authorization_code"),
  redirect_uri: z.string().url().optional(),
});

// ── Routes ─────────────────────────────────────────────

export const oidcRoutes = new Elysia({ prefix: "/api/auth" })
  .use(requestIdMiddleware)
  .use(errorHandlerMiddleware)

  // ── Authorize (public: validates params for the SPA) ─
  .get(
    "/authorize",
    async ({ query, set }) => {
      const parsed = AuthorizeSchema.safeParse(query);
      if (!parsed.success) {
        set.status = 400;
        return { success: false, error: `Invalid authorize request: ${parsed.error.message}` };
      }

      const { client_id, redirect_uri } = parsed.data;

      try {
        const { app, resolvedRedirectUri } = await oidcService.validateAuthorizeRequest(client_id, redirect_uri);
        return successResponse({
          clientId: app.slug,
          appName: app.name,
          redirectUri: resolvedRedirectUri,
        });
      } catch (err) {
        set.status = (err as any).statusCode ?? 400;
        return { success: false, error: (err as Error).message };
      }
    },
    { detail: { tags: ["Auth"], summary: "Validate an authorization request (for the SPA)" } }
  )

  // ── Issue authorization code (protected: SPA calls this after login) ─
  .use(authMiddleware)

  .post(
    "/authorize/confirm",
    async ({ body, headers, set }) => {
      logger.info({ body }, "Authorize confirm request");
      const { user } = await requireAuth(headers);
      const parsed = AuthorizeSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { success: false, error: `Invalid request: ${parsed.error.message}` };
      }

      const { client_id, redirect_uri, state } = parsed.data;

      try {
        // Resolve app by slug or ID
        const app = await authService.getApp(client_id);

        // Resolve redirect_uri: use provided or default to first registered
        const resolvedRedirectUri = redirect_uri ?? (() => {
          const allowed = app.allowedRedirectUris ? (JSON.parse(app.allowedRedirectUris) as string[]) : [];
          if (allowed.length === 0) throw new ValidationError(`No redirect_uri provided and no allowed redirect URIs registered for '${app.name}'.`);
          return allowed[0];
        })();

        const { code } = await oidcService.issueAuthorizationCode(user.id, app.id, resolvedRedirectUri);

        const callbackUrl = new URL(resolvedRedirectUri);
        callbackUrl.searchParams.set("code", code);
        callbackUrl.searchParams.set("state", state);

        return successResponse({ redirectUrl: callbackUrl.toString() });
      } catch (err) {
        set.status = (err as any).statusCode ?? 400;
        return { success: false, error: (err as Error).message };
      }
    },
    {
      body: AuthorizeSchema,
      detail: { tags: ["Auth"], summary: "Issue an authorization code after user authentication" },
    }
  )

  // ── Token exchange (authorization_code + client_credentials) ──
  .post(
    "/token",
    async ({ body, set }) => {
      if (body.grant_type === "authorization_code") {
        const parsed = AuthorizationCodeGrantSchema.safeParse(body);
        if (!parsed.success) {
          set.status = 400;
          return { success: false, error: `Invalid token request: ${parsed.error.message}` };
        }

        try {
          const result = await oidcService.redeemAuthorizationCode(
            parsed.data.code,
            parsed.data.client_id,
            parsed.data.client_secret,
            parsed.data.redirect_uri,
          );
          return successResponse({
            access_token: result.accessToken,
            token_type: result.tokenType,
            expires_in: result.expiresIn,
          });
        } catch (err) {
          set.status = (err as any).statusCode ?? 400;
          return { success: false, error: (err as Error).message };
        }
      }

      if (body.grant_type === "client_credentials") {
        if (!body.client_id || !body.client_secret || !body.audience) {
          set.status = 400;
          return { success: false, error: "client_id, client_secret, and audience are required for client_credentials grant" };
        }

        try {
          const result = await authService.clientCredentialsGrant(
            body.client_id,
            body.client_secret,
            body.audience,
          );
          return successResponse({
            access_token: result.accessToken,
            token_type: "Bearer",
            expires_in: result.expiresIn,
          });
        } catch (err) {
          set.status = (err as any).statusCode ?? 400;
          return { success: false, error: (err as Error).message };
        }
      }

      set.status = 400;
      return { success: false, error: "Unsupported grant_type. Supported: authorization_code, client_credentials" };
    },
    {
      body: z.object({
        grant_type: z.string(),
        client_id: z.string().optional(),
        client_secret: z.string().optional(),
        code: z.string().optional(),
        redirect_uri: z.string().optional(),
        audience: z.string().optional(),
      }),
      detail: { tags: ["Auth"], summary: "OAuth2 token endpoint (authorization_code + client_credentials)" },
    }
  );
