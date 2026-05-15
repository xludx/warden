import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, applications, memberships, authCodes } from "@/db/schema";
import { signJwt } from "@/util/jwt";
import { logger } from "@/util/logger";
import { NotFoundError, ValidationError, ForbiddenError } from "@/errors/service-errors";
import { auditService } from "@/services/AuditService";

const AUTH_CODE_EXPIRY_SECONDS = 300; // 5 minutes

type SafeUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  type: "human" | "service";
  createdAt: Date;
};

class OidcService {
  /**
   * Validate the authorize request and return info about the app and user.
   */
  async validateAuthorizeRequest(
    clientId: string,
    redirectUri?: string,
  ): Promise<{ app: typeof applications.$inferSelect; resolvedRedirectUri: string }> {
    // Resolve app by slug or ID
    const app = await this.getApp(clientId);
    if (!app) throw new NotFoundError("Application", clientId);

    // Resolve redirect URI: use provided or default to first registered
    const resolved = this.resolveRedirectUri(app, redirectUri);

    return { app, resolvedRedirectUri: resolved };
  }

  /**
   * Issue an authorization code for a user + app.
   * Called after the user has authenticated on the login page.
   */
  async issueAuthorizationCode(
    userId: string,
    appId: string,
    redirectUri: string,
  ): Promise<{ code: string }> {
    // Verify user exists
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) throw new NotFoundError("User", userId);

    // Verify app exists
    const app = await this.getApp(appId);
    if (!app) throw new NotFoundError("Application", appId);

    // Validate redirect URI against app configuration
    this.validateRedirectUri(app, redirectUri, true /* required here */);

    // Verify user has a membership for this app
    const membership = await db.select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.appId, app.id)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenError(`User does not have access to '${app.name}'. Contact the application admin.`);
    }

    // Generate single-use authorization code
    const id = nanoid();
    const code = createHash("sha256").update(nanoid(48)).digest("hex").slice(0, 48);

    await db.insert(authCodes).values({
      id,
      appId: app.id,
      userId,
      code,
      redirectUri,
      expiresAt: new Date(Date.now() + AUTH_CODE_EXPIRY_SECONDS * 1000),
    });

    logger.info({ userId, appId: app.id }, "Authorization code issued");
    await auditService.log({
      action: "auth_code.issued",
      actorId: userId,
      actorType: "human",
      actorName: userRows[0].name,
      targetType: "auth_code",
      targetId: id,
      appId: app.id,
    });

    return { code };
  }

  /**
   * Redeem an authorization code for an access token (JWT).
   * This is called by the app's backend, not the browser.
   */
  async redeemAuthorizationCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; tokenType: string; expiresIn: number }> {
    // Look up the app by slug or ID
    const app = await this.getApp(clientId);
    if (!app) throw new NotFoundError("Application", clientId);

    // Verify client secret
    if (app.jwtSecret !== clientSecret) {
      throw new ValidationError("Invalid client credentials");
    }

    // Find the auth code
    const codeRows = await db.select()
      .from(authCodes)
      .where(and(eq(authCodes.code, code), isNull(authCodes.usedAt)))
      .limit(1);

    if (codeRows.length === 0) {
      throw new ValidationError("Invalid, expired, or already used authorization code");
    }

    const authCode = codeRows[0];

    // Verify it belongs to this app
    if (authCode.appId !== app.id) {
      throw new ValidationError("Authorization code was not issued for this application");
    }

    // Verify redirect URI matches
    if (authCode.redirectUri !== redirectUri) {
      throw new ValidationError("Redirect URI does not match");
    }

    // Verify not expired
    if (authCode.expiresAt < new Date()) {
      throw new ValidationError("Authorization code has expired");
    }

    // Mark as used
    await db.update(authCodes)
      .set({ usedAt: new Date() })
      .where(eq(authCodes.id, authCode.id));

    // Look up user and membership
    const userRows = await db.select().from(users).where(eq(users.id, authCode.userId)).limit(1);
    if (userRows.length === 0) throw new NotFoundError("User", authCode.userId);

    const membership = await db.select()
      .from(memberships)
      .where(and(eq(memberships.userId, authCode.userId), eq(memberships.appId, app.id)))
      .limit(1);

    const role = membership.length > 0 ? membership[0].role : "viewer";

    // Issue JWT signed with the app's jwt_secret
    const expiresIn = 3600;
    const accessToken = await signJwt(
      {
        sub: authCode.userId,
        email: userRows[0].email ?? undefined,
        name: userRows[0].name,
        app: app.slug,
        role,
        type: "human",
      },
      app.jwtSecret,
    );

    logger.info({ userId: authCode.userId, appId: app.id }, "Authorization code redeemed");
    await auditService.log({
      action: "auth_code.redeemed",
      actorId: authCode.userId,
      actorType: "human",
      actorName: userRows[0].name,
      targetType: "auth_code",
      targetId: authCode.id,
      appId: app.id,
    });

    return { accessToken, tokenType: "Bearer", expiresIn };
  }

  private resolveRedirectUri(app: typeof applications.$inferSelect, redirectUri?: string): string {
    const allowedUris = app.allowedRedirectUris ? (JSON.parse(app.allowedRedirectUris) as string[]) : [];

    // If redirect_uri provided, validate and use it
    if (redirectUri) {
      this.validateRedirectUri(app, redirectUri);
      return redirectUri;
    }

    // No redirect_uri provided — use first registered URI
    if (allowedUris.length === 0) {
      throw new ValidationError(
        `No redirect_uri provided and no allowed redirect URIs registered for '${app.name}'. Either pass redirect_uri or register at least one in the application settings.`,
      );
    }

    return allowedUris[0];
  }

  private validateRedirectUri(app: typeof applications.$inferSelect, redirectUri: string, required = false): void {
    const allowedUris = app.allowedRedirectUris ? (JSON.parse(app.allowedRedirectUris) as string[]) : [];

    if (allowedUris.length > 0) {
      const valid = allowedUris.some((uri) => redirectUri.startsWith(uri));
      if (!valid) {
        throw new ValidationError(
          `Redirect URI '${redirectUri}' is not allowed for this application. Allowed: ${allowedUris.join(", ")}`,
        );
      }
    }
    // If no allowed URIs configured, any URI is accepted (backward compat)
  }

  private async getApp(clientId: string): Promise<typeof applications.$inferSelect | null> {
    // Try by slug first (most common use case)
    const bySlug = await db.select().from(applications).where(eq(applications.slug, clientId)).limit(1);
    if (bySlug.length > 0) return bySlug[0];

    // Fall back to ID
    const byId = await db.select().from(applications).where(eq(applications.id, clientId)).limit(1);
    if (byId.length > 0) return byId[0];

    return null;
  }
}

export const oidcService = new OidcService();
