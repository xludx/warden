import { Elysia } from "elysia";
import { verifyJwt } from "@/util/jwt";
import { authService } from "@/services/AuthService";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  type: "human" | "service";
  app: string;
  role?: string;
};

type AuthApp = {
  id: string;
  slug: string;
  name: string;
  jwtSecret: string;
};

export type AuthContext = {
  user: AuthUser;
  authApp: AuthApp;
};

export const authMiddleware = new Elysia({ name: "auth" }).derive(
  async ({ headers, error }): Promise<AuthContext> => {
    const authHeader = headers["authorization"];
    const apiKeyHeader = headers["x-api-key"];

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const payload = await verifyJwt(authHeader.slice(7));
        const app = await authService.getApp(payload.app);
        return {
          user: { id: payload.sub, email: payload.email ?? null, name: payload.name, type: payload.type, app: payload.app, role: payload.role },
          authApp: { id: app.id, slug: app.slug, name: app.name, jwtSecret: app.jwtSecret },
        };
      } catch {
        return error(401, { success: false, error: "Invalid or expired token" });
      }
    }

    if (apiKeyHeader && typeof apiKeyHeader === "string") {
      try {
        const { user, app, scopes } = await authService.authenticateByApiKey(apiKeyHeader);
        return {
          user: { id: user.id, email: user.email, name: user.name, type: user.type, app: app.slug, role: scopes.join(",") },
          authApp: { id: app.id, slug: app.slug, name: app.name, jwtSecret: app.jwtSecret },
        };
      } catch {
        return error(401, { success: false, error: "Invalid API key" });
      }
    }

    return error(401, { success: false, error: "Authentication required. Provide Authorization: Bearer <token> or x-api-key header." });
  }
);

export const wardenAdminMiddleware = new Elysia({ name: "warden.admin" }).derive(
  async ({ headers, error }): Promise<AuthContext> => {
    const authHeader = headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return error(401, { success: false, error: "Admin access requires Bearer token" });
    }

    try {
      const payload = await verifyJwt(authHeader.slice(7));
      if (payload.app !== "warden") {
        return error(403, { success: false, error: "Not authorized for warden admin" });
      }

      const wardenApp = await authService.getApp("warden");
      const membershipRows = await db.select().from(memberships).where(
        and(eq(memberships.userId, payload.sub), eq(memberships.appId, wardenApp.id)),
      ).limit(1);

      if (membershipRows.length === 0 || membershipRows[0].role !== "admin") {
        return error(403, { success: false, error: "Admin role required" });
      }

      return {
        user: { id: payload.sub, email: payload.email ?? null, name: payload.name, type: payload.type, app: "warden", role: "admin" },
        authApp: { id: wardenApp.id, slug: wardenApp.slug, name: wardenApp.name, jwtSecret: wardenApp.jwtSecret },
      };
    } catch {
      return error(401, { success: false, error: "Invalid or expired token" });
    }
  }
);
