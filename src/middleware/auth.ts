import { Elysia } from "elysia";
import { decodeJwt } from "jose";
import { verifyJwt, type JwtPayload } from "@/util/jwt";
import { authService } from "@/services/AuthService";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { ForbiddenError, UnauthorizedError } from "@/errors/service-errors";
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

async function verifyApplicationToken(token: string): Promise<AuthContext> {
  let unverified: Partial<JwtPayload>;
  try {
    unverified = decodeJwt(token) as Partial<JwtPayload>;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (!unverified.app) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  const app = await authService.getApp(unverified.app);

  try {
    const payload = await verifyJwt(token, app.jwtSecret);
    return {
      user: { id: payload.sub, email: payload.email ?? null, name: payload.name, type: payload.type, app: payload.app, role: payload.role },
      authApp: { id: app.id, slug: app.slug, name: app.name, jwtSecret: app.jwtSecret },
    };
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export async function requireAuth(headers: Record<string, string | undefined>): Promise<AuthContext> {
  const authHeader = headers["authorization"];
  const apiKeyHeader = headers["x-api-key"];

  if (authHeader?.startsWith("Bearer ")) {
    return verifyApplicationToken(authHeader.slice(7));
  }

  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    try {
      const { user, app, scopes } = await authService.authenticateByApiKey(apiKeyHeader);
      return {
        user: { id: user.id, email: user.email, name: user.name, type: user.type, app: app.slug, role: scopes.join(",") },
        authApp: { id: app.id, slug: app.slug, name: app.name, jwtSecret: app.jwtSecret },
      };
    } catch {
      throw new UnauthorizedError("Invalid API key");
    }
  }

  throw new UnauthorizedError("Authentication required. Provide Authorization: Bearer <token> or x-api-key header.");
}

export const authMiddleware = new Elysia({ name: "auth" }).derive(
  async ({ headers }) => requireAuth(headers)
);

export async function requireWardenAdmin(headers: Record<string, string | undefined>): Promise<AuthContext> {
  const authHeader = headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Admin access requires Bearer token");
  }

  const { user, authApp: wardenApp } = await verifyApplicationToken(authHeader.slice(7));

  if (user.app !== "warden") {
    throw new ForbiddenError("Not authorized for warden admin");
  }

  const membershipRows = await db.select().from(memberships).where(
    and(eq(memberships.userId, user.id), eq(memberships.appId, wardenApp.id)),
  ).limit(1);

  if (membershipRows.length === 0 || membershipRows[0].role !== "admin") {
    throw new ForbiddenError("Admin role required");
  }

  return {
    user: { ...user, app: "warden", role: "admin" },
    authApp: wardenApp,
  };
}

export const wardenAdminMiddleware = new Elysia({ name: "warden.admin" }).derive(
  async ({ headers }) => requireWardenAdmin(headers)
);
