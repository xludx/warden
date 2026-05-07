import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "@/db";
import { users, credentials, memberships, apiKeys, applications } from "@/db/schema";
import { signJwt } from "@/util/jwt";
import { env } from "@/util/env";
import { logger } from "@/util/logger";
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from "@/errors/service-errors";
import { auditService } from "@/services/AuditService";

type SafeUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  type: "human" | "service";
  createdAt: Date;
};

function stripUser(u: typeof users.$inferSelect): SafeUser {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, type: u.type, createdAt: u.createdAt };
}

export class AuthService {
  // ── Registration ───────────────────────────────────

  async register(input: {
    name: string;
    email: string;
    password: string;
    appId: string;
  }): Promise<{ user: SafeUser; token: string }> {
    const app = await this.getApp(input.appId);
    if (!app) throw new NotFoundError("Application", input.appId);

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) {
      throw new ConflictError("Email already registered");
    }

    const userId = nanoid();
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    await db.insert(users).values({
      id: userId,
      email: input.email,
      name: input.name,
      type: "human",
    });

    await db.insert(credentials).values({
      id: nanoid(),
      userId,
      type: "password",
      provider: "password",
      credentialData: { password_hash: passwordHash },
    });

    await db.insert(memberships).values({
      id: nanoid(),
      userId,
      appId: app.id,
      role: "viewer",
    });

    const token = await signJwt(
      { sub: userId, email: input.email, name: input.name, app: app.slug, role: "viewer", type: "human" },
      app.jwtSecret,
    );
    logger.info({ userId, email: input.email, app: app.slug }, "User registered");
    await auditService.log({ action: "user.registered", actorId: userId, actorType: "human", actorName: input.name, targetType: "user", targetId: userId, targetName: input.name, appId: app.id });

    return {
      user: { id: userId, email: input.email, name: input.name, avatarUrl: null, type: "human", createdAt: new Date() },
      token,
    };
  }

  // ── Login ─────────────────────────────────────────

  async login(email: string, password: string, appId: string): Promise<{ user: SafeUser; token: string }> {
    const app = await this.getApp(appId);
    if (!app) throw new NotFoundError("Application", appId);

    const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];
    if (!user || user.type !== "human") {
      throw new ValidationError("Invalid email or password");
    }

    const credRows = await db.select().from(credentials).where(
      and(eq(credentials.userId, user.id), eq(credentials.type, "password")),
    ).limit(1);
    const cred = credRows[0];
    if (!cred) {
      throw new ValidationError("Invalid email or password");
    }

    const passwordHash = (cred.credentialData as { password_hash: string }).password_hash;
    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      throw new ValidationError("Invalid email or password");
    }

    const membership = await this.getMembership(user.id, app.id);
    const role = membership?.role ?? "viewer";

    const token = await signJwt(
      { sub: user.id, email: user.email!, name: user.name, app: app.slug, role, type: "human" },
      app.jwtSecret,
    );
    logger.info({ userId: user.id, app: app.slug }, "User logged in");
    await auditService.log({ action: "user.login", actorId: user.id, actorType: "human", actorName: user.name, targetType: "user", targetId: user.id, targetName: user.name, appId: app.id });

    return { user: stripUser(user), token };
  }

  // ── Get user ──────────────────────────────────────

  async getUser(id: string): Promise<SafeUser> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    if (!user) throw new NotFoundError("User", id);
    return stripUser(user);
  }

  // ── API Keys ──────────────────────────────────────

  async createApiKey(userId: string, appId: string, name: string): Promise<{ id: string; key: string; prefix: string; name: string }> {
    await this.getUser(userId);
    const app = await this.getApp(appId);

    const id = nanoid();
    const prefix = app.slug.slice(0, 4);
    const rawKey = `${prefix}_${nanoid(32)}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const displayPrefix = rawKey.slice(0, 12);

    await db.insert(apiKeys).values({ id, userId, appId, name, keyHash, prefix: displayPrefix });
    logger.info({ apiKeyId: id, userId, appId, name }, "API key created");
    await auditService.log({ action: "api_key.created", actorId: userId, actorType: "human", actorName: (await this.getUser(userId)).name ?? "", targetType: "api_key", targetId: id, targetName: name, appId });

    return { id, key: rawKey, prefix: displayPrefix, name };
  }

  async listApiKeys(userId: string, appId: string): Promise<{ id: string; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null }[]> {
    return db.select({
      id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt,
    }).from(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.appId, appId)));
  }

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    const rows = await db.select({ id: apiKeys.id, userId: apiKeys.userId }).from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
    const key = rows[0];
    if (!key) throw new NotFoundError("API key", keyId);
    if (key.userId !== userId) throw new NotFoundError("API key", keyId);
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    logger.info({ apiKeyId: keyId, userId }, "API key revoked");
    await auditService.log({ action: "api_key.revoked", actorId: userId, actorType: "human", targetType: "api_key", targetId: keyId });
  }

  async authenticateByApiKey(rawKey: string): Promise<{ user: SafeUser; app: typeof applications.$inferSelect; scopes: string[] }> {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const rows = await db.select({ apiKey: apiKeys, user: users, app: applications })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .innerJoin(applications, eq(apiKeys.appId, applications.id))
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    const row = rows[0];
    if (!row) throw new ValidationError("Invalid API key");

    // Update lastUsedAt (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.apiKey.id))
      .then()
      .catch((err) => logger.error({ err }, "Failed to update API key lastUsedAt"));

    // If service account, look up scopes from grants
    let scopes: string[] = [];
    if (row.user.type === "service") {
      const { serviceGrants } = await import("@/db/schema");
      const grants = await db.select({ scopes: serviceGrants.scopes })
        .from(serviceGrants)
        .where(and(eq(serviceGrants.serviceUserId, row.user.id), eq(serviceGrants.targetAppId, row.app.id)));
      scopes = grants.flatMap((g) => g.scopes as string[]);
    }

    return { user: stripUser(row.user), app: row.app, scopes };
  }

  // ── Client Credentials (service → JWT) ────────────

  async clientCredentialsGrant(clientId: string, clientSecret: string, audience: string): Promise<{ accessToken: string; expiresIn: number }> {
    // clientSecret IS the API key
    const { user, app: sourceApp, scopes } = await this.authenticateByApiKey(clientSecret);

    if (user.type !== "service") throw new ForbiddenError("Client credentials flow is for service accounts only");

    // Find target app
    const targetApp = await this.getAppBySlug(audience);

    // Verify grant exists
    const { serviceGrants } = await import("@/db/schema");
    const grant = await db.select().from(serviceGrants).where(
      and(eq(serviceGrants.serviceUserId, user.id), eq(serviceGrants.targetAppId, targetApp.id)),
    ).limit(1);

    if (grant.length === 0) throw new ForbiddenError(`Service '${user.name}' is not granted access to '${audience}'`);

    const expiresIn = 3600;
    const token = await signJwt(
      {
        sub: user.id,
        name: user.name,
        app: sourceApp.slug,
        aud: audience,
        scope: (grant[0].scopes as string[]).join(" "),
        type: "service",
      },
      targetApp.jwtSecret,
    );

    logger.info({ serviceUserId: user.id, sourceApp: sourceApp.slug, audience }, "Client credentials token issued");
    await auditService.log({ action: "token.client_credentials", actorId: user.id, actorType: "service", actorName: user.name, targetType: "application", targetId: targetApp.id, targetName: audience, appId: sourceApp.id });

    return { accessToken: token, expiresIn };
  }

  // ── Verify endpoint (for other backends) ──────────

  async verify(rawKey: string): Promise<{ user: SafeUser; app: { id: string; slug: string; name: string }; scopes: string[] }> {
    const { user, app, scopes } = await this.authenticateByApiKey(rawKey);
    return { user, app: { id: app.id, slug: app.slug, name: app.name }, scopes };
  }

  // ── Helpers ───────────────────────────────────────

  async getApp(appIdOrSlug: string): Promise<typeof applications.$inferSelect> {
    const rows = await db.select().from(applications).where(
      eq(applications.id, appIdOrSlug),
    ).limit(1);
    if (rows.length === 0) {
      // Try slug
      const bySlug = await db.select().from(applications).where(eq(applications.slug, appIdOrSlug)).limit(1);
      if (bySlug.length === 0) throw new NotFoundError("Application", appIdOrSlug);
      return bySlug[0];
    }
    return rows[0];
  }

  async getAppBySlug(slug: string): Promise<typeof applications.$inferSelect> {
    const rows = await db.select().from(applications).where(eq(applications.slug, slug)).limit(1);
    if (rows.length === 0) throw new NotFoundError("Application", slug);
    return rows[0];
  }

  async getMembership(userId: string, appId: string): Promise<typeof memberships.$inferSelect | null> {
    const rows = await db.select().from(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.appId, appId)),
    ).limit(1);
    return rows[0] ?? null;
  }
}

export const authService = new AuthService();
