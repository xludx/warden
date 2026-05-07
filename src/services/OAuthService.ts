import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db";
import { users, credentials, memberships, oauthProviders, applications } from "@/db/schema";
import { signJwt } from "@/util/jwt";
import { env } from "@/util/env";
import { logger } from "@/util/logger";
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from "@/errors/service-errors";
import { auditService } from "@/services/AuditService";
import { buildAuthorizationUrl, exchangeCode, fetchProfile, type Provider } from "@/clients/oauth";

type SafeUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  type: "human" | "service";
  createdAt: Date;
};

type StatePayload = {
  appId: string;
  redirect: string;
  nonce: string;
  iat: number;
};

const STATE_EXPIRY_SECONDS = 600; // 10 minutes

function stripUser(u: typeof users.$inferSelect): SafeUser {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, type: u.type, createdAt: u.createdAt };
}

class OAuthService {
  /**
   * Start the OAuth authorization flow.
   * Returns the URL to redirect the user to (provider's consent screen).
   */
  async startAuthorization(
    provider: Provider,
    appId: string,
    redirect: string,
  ): Promise<{ redirectUrl: string }> {
    // Look up the OAuth provider config for this app
    const configs = await db.select()
      .from(oauthProviders)
      .where(and(eq(oauthProviders.appId, appId), eq(oauthProviders.provider, provider)))
      .limit(1);

    const config = configs[0];
    if (!config) {
      throw new NotFoundError(`OAuth provider '${provider}' not configured for this application`);
    }

    // Build a signed state JWT: { appId, redirect, nonce, iat }
    const state = await new SignJWT({
      appId,
      redirect,
      nonce: nanoid(16),
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    const scope = config.scopes ?? "openid email profile";

    const authorizationUrl = buildAuthorizationUrl(provider, config.clientId, config.redirectUri!, scope, state);

    logger.info({ provider, appId }, "OAuth authorization started");
    await auditService.log({ action: "oauth.started", actorType: "system", targetType: "oauth_provider", targetId: config.id, appId });

    return { redirectUrl: authorizationUrl };
  }

  /**
   * Handle the OAuth callback from the provider.
   * Returns a JWT for the app and the user.
   */
  async handleCallback(
    provider: Provider,
    code: string,
    state: string,
    error?: string,
  ): Promise<{ user: SafeUser; token: string; redirect: string }> {
    // Check for provider errors
    if (error) {
      throw new ValidationError(`OAuth provider returned an error: ${error}`);
    }

    // Decode and validate the state JWT
    let statePayload: StatePayload;
    try {
      const { payload } = await jwtVerify(
        state,
        new TextEncoder().encode(env.JWT_SECRET),
      );
      statePayload = payload as unknown as StatePayload;
    } catch {
      throw new ValidationError("Invalid or expired OAuth state");
    }

    // Check state expiry
    const now = Math.floor(Date.now() / 1000);
    if (statePayload.iat + STATE_EXPIRY_SECONDS < now) {
      throw new ValidationError("OAuth state has expired. Please try again.");
    }

    const { appId, redirect } = statePayload;

    // Look up the OAuth provider config again (needed for client_secret and redirect_uri)
    const configs = await db.select()
      .from(oauthProviders)
      .where(and(eq(oauthProviders.appId, appId), eq(oauthProviders.provider, provider)))
      .limit(1);

    const config = configs[0];
    if (!config) {
      throw new NotFoundError(`OAuth provider '${provider}' config not found for this application`);
    }

    // Exchange code for tokens
    const tokenResult = await exchangeCode(provider, config.clientId, config.clientSecret, code, config.redirectUri!);

    // Fetch user profile
    const profile = await fetchProfile(provider, tokenResult.accessToken);

    // Look up existing credential by (provider, providerUserId)
    const existingCred = await db.select({ id: credentials.id, userId: credentials.userId })
      .from(credentials)
      .where(and(eq(credentials.provider, provider), eq(credentials.providerUserId, profile.id)))
      .limit(1);

    let userId: string;

    if (existingCred.length > 0) {
      // Existing user — update credential data (refresh token, etc.)
      userId = existingCred[0].userId;
      await db.update(credentials)
        .set({
          credentialData: {
            access_token: tokenResult.accessToken,
            refresh_token: tokenResult.refreshToken,
            scope: tokenResult.scope,
          },
        })
        .where(eq(credentials.id, existingCred[0].id));

      logger.info({ userId, provider, profileId: profile.id }, "OAuth: existing user authenticated");
    } else {
      // New user — check if registration is allowed
      const app = await this.getApp(appId);

      if (!app.allowRegistration) {
        throw new ForbiddenError(
          "Registration is disabled for this application. Contact your admin to get access.",
        );
      }

      // Check if a user with this email already exists
      const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, profile.email)).limit(1);

      if (existingUser.length > 0) {
        // Link OAuth to existing user
        userId = existingUser[0].id;
        await db.insert(credentials).values({
          id: nanoid(),
          userId,
          type: "oauth",
          provider,
          providerUserId: profile.id,
          credentialData: {
            access_token: tokenResult.accessToken,
            refresh_token: tokenResult.refreshToken,
            scope: tokenResult.scope,
          },
        });

        logger.info({ userId, provider, profileId: profile.id }, "OAuth: linked to existing user");
      } else {
        // Create new user
        userId = nanoid();
        await db.insert(users).values({
          id: userId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          type: "human",
        });

        await db.insert(credentials).values({
          id: nanoid(),
          userId,
          type: "oauth",
          provider,
          providerUserId: profile.id,
          credentialData: {
            access_token: tokenResult.accessToken,
            refresh_token: tokenResult.refreshToken,
            scope: tokenResult.scope,
          },
        });

        // Grant viewer membership to the app they're authenticating for
        await db.insert(memberships).values({
          id: nanoid(),
          userId,
          appId,
          role: "viewer",
        });

        logger.info({ userId, provider, profileId: profile.id, appId }, "OAuth: new user created");
      }
    }

    // Ensure the user has a membership for this app (if they were linked but not a member)
    const membership = await db.select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.appId, appId)))
      .limit(1);

    if (membership.length === 0) {
      await db.insert(memberships).values({
        id: nanoid(),
        userId,
        appId,
        role: "viewer",
      });
    }

    const app = await this.getApp(appId);
    const role = membership.length > 0 ? membership[0].role : "viewer";

    // Sign a JWT for the app
    const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRecord.length === 0) throw new NotFoundError("User", userId);

    const token = await signJwt(
      {
        sub: userId,
        email: userRecord[0].email ?? undefined,
        name: userRecord[0].name,
        app: app.slug,
        role,
        type: "human",
      },
      app.jwtSecret,
    );

    logger.info({ userId, appId, provider }, "OAuth callback completed");
    await auditService.log({
      action: "oauth.callback",
      actorId: userId,
      actorType: "human",
      actorName: profile.name,
      targetType: "oauth_provider",
      targetId: config.id,
      appId,
    });

    return { user: stripUser(userRecord[0]), token, redirect };
  }

  private async getApp(appId: string): Promise<typeof applications.$inferSelect> {
    const rows = await db.select().from(applications).where(eq(applications.id, appId)).limit(1);
    if (rows.length === 0) {
      const bySlug = await db.select().from(applications).where(eq(applications.slug, appId)).limit(1);
      if (bySlug.length === 0) throw new NotFoundError("Application", appId);
      return bySlug[0];
    }
    return rows[0];
  }
}

export const oauthService = new OAuthService();
