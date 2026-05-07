import { Elysia } from "elysia";
import { errorHandlerMiddleware } from "@/middleware/error-handler";
import { requestIdMiddleware } from "@/middleware/request-id";
import { oauthService } from "@/services/OAuthService";

const providers = ["google", "github"] as const;
type Provider = (typeof providers)[number];

export const oauthRoutes = new Elysia({ prefix: "/api/auth/oauth" })
  .use(requestIdMiddleware)
  .use(errorHandlerMiddleware)

  // ── Start authorization ──────────────────────────
  // GET /api/auth/oauth/:provider/authorize?appId=warden&redirect=/admin
  .get(
    "/:provider/authorize",
    async ({ params, query, set }) => {
      const { provider } = params as { provider: Provider };
      if (!providers.includes(provider)) {
        set.status = 400;
        return { success: false, error: `Unsupported OAuth provider '${provider}'. Supported: ${providers.join(", ")}` };
      }

      const appId = (query as Record<string, string>).appId ?? "warden";
      const redirect = (query as Record<string, string>).redirect ?? "/login";

      const result = await oauthService.startAuthorization(provider, appId, redirect);
      // Use direct redirect instead of set.redirect to avoid content-type issues
      set.headers["Location"] = result.redirectUrl;
      set.status = 302;
      return new Response(null, { status: 302, headers: { Location: result.redirectUrl } });
    },
    { detail: { tags: ["Auth"], summary: "Start OAuth authorization flow" } }
  )

  // ── Handle OAuth callback ────────────────────────
  // GET /api/auth/oauth/:provider/callback?code=...&state=...&error=...
  .get(
    "/:provider/callback",
    async ({ params, query, set }) => {
      const { provider } = params as { provider: Provider };
      if (!providers.includes(provider)) {
        set.status = 400;
        return { success: false, error: `Unsupported OAuth provider '${provider}'` };
      }

      const q = query as Record<string, string>;
      const code = q.code;
      const state = q.state;
      const oauthError = q.error;

      if (!code || !state) {
        set.status = 400;
        return { success: false, error: "Missing required parameters: code and state" };
      }

      try {
        const result = await oauthService.handleCallback(provider, code, state, oauthError);

        const targetUrl = `${result.redirect}?token=${result.token}`;
        return new Response(null, { status: 302, headers: { Location: targetUrl } });
      } catch (err) {
        const errorUrl = `/login?error=${encodeURIComponent((err as Error).message)}`;
        return new Response(null, { status: 302, headers: { Location: errorUrl } });
      }
    },
    { detail: { tags: ["Auth"], summary: "Handle OAuth callback" } }
  );
