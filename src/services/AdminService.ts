import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "@/db";
import { users, credentials, memberships, applications, apiKeys, serviceGrants, oauthProviders } from "@/db/schema";
import { env } from "@/util/env";
import { logger } from "@/util/logger";
import { ConflictError, NotFoundError, ForbiddenError } from "@/errors/service-errors";
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

export class AdminService {
  // ── Applications ──────────────────────────────────

  async createApplication(name: string, slug: string, allowRegistration?: boolean): Promise<typeof applications.$inferSelect> {
    const existing = await db.select({ id: applications.id }).from(applications).where(eq(applications.slug, slug)).limit(1);
    if (existing.length > 0) throw new ConflictError(`Application slug '${slug}' already taken`);

    const id = nanoid();
    const jwtSecret = nanoid(48);

    await db.insert(applications).values({ id, name, slug, jwtSecret, ...(allowRegistration !== undefined ? { allowRegistration } : {}) });
    logger.info({ appId: id, slug }, "Application created");

    const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return rows[0];
  }

  async listApplications(): Promise<(typeof applications.$inferSelect)[]> {
    return db.select().from(applications);
  }

  async getApplication(id: string): Promise<typeof applications.$inferSelect> {
    const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundError("Application", id);
    return rows[0];
  }

  async deleteApplication(id: string): Promise<void> {
    const app = await this.getApplication(id);
    if (app.slug === "warden") throw new ForbiddenError("The Warden control-plane application cannot be deleted");
    await db.delete(applications).where(eq(applications.id, id));
    logger.info({ appId: id }, "Application deleted");
  }

  async updateApplication(id: string, data: { allowRegistration?: boolean; allowedRedirectUris?: string[] }): Promise<typeof applications.$inferSelect> {
    const app = await this.getApplication(id);
    const updates: Record<string, unknown> = {};

    if (data.allowRegistration !== undefined) {
      updates.allowRegistration = data.allowRegistration;
    }

    if (data.allowedRedirectUris !== undefined) {
      updates.allowedRedirectUris = JSON.stringify(data.allowedRedirectUris);
    }

    if (Object.keys(updates).length > 0) {
      await db.update(applications).set(updates).where(eq(applications.id, id));
      logger.info({ appId: id, ...updates }, "Application updated");
    }
    const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return rows[0];
  }

  async rotateAppSecret(id: string): Promise<typeof applications.$inferSelect> {
    const app = await this.getApplication(id);
    if (app.slug === "warden") throw new ForbiddenError("The Warden control-plane JWT secret cannot be rotated here");
    const newSecret = nanoid(48);
    await db.update(applications).set({ jwtSecret: newSecret }).where(eq(applications.id, id));
    logger.info({ appId: id }, "Application JWT secret rotated");
    const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return rows[0];
  }

  // ── Users ─────────────────────────────────────────

  async listUsers(): Promise<SafeUser[]> {
    const rows = await db.select().from(users).where(eq(users.type, "human"));
    return rows.map(stripUser);
  }

  async getUser(id: string): Promise<SafeUser> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (rows.length === 0) throw new NotFoundError("User", id);
    return stripUser(rows[0]);
  }

  async deleteUser(id: string): Promise<void> {
    await this.getUser(id);
    await db.delete(users).where(eq(users.id, id));
    logger.info({ userId: id }, "User deleted");
  }

  // ── Memberships ──────────────────────────────────

  async addMembership(userId: string, appId: string, role: string): Promise<void> {
    await this.getUser(userId);
    await this.getApplication(appId);

    const existing = await db.select({ id: memberships.id }).from(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.appId, appId)),
    ).limit(1);
    if (existing.length > 0) throw new ConflictError("User is already a member of this application");

    await db.insert(memberships).values({ id: nanoid(), userId, appId, role });
    logger.info({ userId, appId, role }, "Membership added");
  }

  async removeMembership(userId: string, appId: string): Promise<void> {
    const rows = await db.select().from(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.appId, appId)),
    ).limit(1);
    if (rows.length === 0) throw new NotFoundError("Membership");
    await db.delete(memberships).where(eq(memberships.id, rows[0].id));
    logger.info({ userId, appId }, "Membership removed");
  }

  async listUserMemberships(userId: string): Promise<{ app: typeof applications.$inferSelect; role: string }[]> {
    const rows = await db.select({ membership: memberships, app: applications })
      .from(memberships)
      .innerJoin(applications, eq(memberships.appId, applications.id))
      .where(eq(memberships.userId, userId));
    return rows.map((r) => ({ app: r.app, role: r.membership.role }));
  }

  // ── Service Accounts ─────────────────────────────

  async createServiceAccount(name: string, appId: string): Promise<{ user: SafeUser; clientId: string; clientSecret: string }> {
    await this.getApplication(appId);

    const userId = nanoid();
    await db.insert(users).values({ id: userId, name, type: "service" });

    // Auto-add membership
    await db.insert(memberships).values({ id: nanoid(), userId, appId, role: "admin" });

    // Generate API key as client credentials
    const app = await this.getApplication(appId);
    const prefix = app.slug.slice(0, 4);
    const clientSecret = `${prefix}_${nanoid(32)}`;
    const keyHash = createHash("sha256").update(clientSecret).digest("hex");
    const displayPrefix = clientSecret.slice(0, 12);

    await db.insert(apiKeys).values({
      id: nanoid(),
      userId,
      appId,
      name: "default",
      keyHash,
      prefix: displayPrefix,
    });

    logger.info({ userId, name, appId }, "Service account created");

    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return {
      user: stripUser(userRows[0]),
      clientId: userId,
      clientSecret,
    };
  }

  async listServiceAccounts(): Promise<SafeUser[]> {
    const rows = await db.select().from(users).where(eq(users.type, "service"));
    return rows.map(stripUser);
  }

  async deleteServiceAccount(id: string): Promise<void> {
    const user = await this.getUser(id);
    if (user.type !== "service") throw new ForbiddenError("Not a service account");
    await db.delete(users).where(eq(users.id, id));
    logger.info({ userId: id }, "Service account deleted");
  }

  // ── Service Grants ───────────────────────────────

  async addServiceGrant(serviceUserId: string, targetAppId: string, scopes: string[]): Promise<typeof serviceGrants.$inferSelect> {
    const user = await this.getUser(serviceUserId);
    if (user.type !== "service") throw new ForbiddenError("Not a service account");
    await this.getApplication(targetAppId);

    const id = nanoid();
    await db.insert(serviceGrants).values({ id, serviceUserId, targetAppId, scopes });
    logger.info({ serviceUserId, targetAppId, scopes }, "Service grant added");

    const rows = await db.select().from(serviceGrants).where(eq(serviceGrants.id, id)).limit(1);
    return rows[0];
  }

  async removeServiceGrant(grantId: string): Promise<void> {
    const rows = await db.select().from(serviceGrants).where(eq(serviceGrants.id, grantId)).limit(1);
    if (rows.length === 0) throw new NotFoundError("Service grant", grantId);
    await db.delete(serviceGrants).where(eq(serviceGrants.id, grantId));
    logger.info({ grantId }, "Service grant removed");
  }

  async listServiceGrants(serviceUserId: string): Promise<(typeof serviceGrants.$inferSelect)[]> {
    return db.select().from(serviceGrants).where(eq(serviceGrants.serviceUserId, serviceUserId));
  }

  // ── OAuth Providers ───────────────────────────────

  async configureOAuthProvider(
    appId: string,
    provider: "google" | "github",
    clientId: string,
    clientSecret: string,
    scopes: string | undefined,
    redirectUri: string,
  ): Promise<typeof oauthProviders.$inferSelect> {
    const app = await this.getApplication(appId);

    const existing = await db.select({ id: oauthProviders.id })
      .from(oauthProviders)
      .where(and(eq(oauthProviders.appId, app.id), eq(oauthProviders.provider, provider)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing config
      await db.update(oauthProviders)
        .set({ clientId, clientSecret, scopes: scopes ?? null, redirectUri })
        .where(eq(oauthProviders.id, existing[0].id));

      const rows = await db.select().from(oauthProviders).where(eq(oauthProviders.id, existing[0].id)).limit(1);
      logger.info({ appId: app.id, provider }, "OAuth provider updated");
      return rows[0];
    }

    await db.insert(oauthProviders).values({
      id: nanoid(),
      appId: app.id,
      provider,
      clientId,
      clientSecret,
      scopes: scopes ?? null,
      redirectUri,
    });

    const rows = await db.select().from(oauthProviders).where(
      and(eq(oauthProviders.appId, app.id), eq(oauthProviders.provider, provider)),
    ).limit(1);
    logger.info({ appId: app.id, provider }, "OAuth provider configured");
    return rows[0];
  }

  async listOAuthProviders(appId: string): Promise<(typeof oauthProviders.$inferSelect)[]> {
    await this.getApplication(appId);
    return db.select().from(oauthProviders).where(eq(oauthProviders.appId, appId));
  }

  async deleteOAuthProvider(appId: string, providerId: string): Promise<void> {
    await this.getApplication(appId);
    const rows = await db.select({ id: oauthProviders.id, appId: oauthProviders.appId })
      .from(oauthProviders)
      .where(eq(oauthProviders.id, providerId))
      .limit(1);

    if (rows.length === 0) throw new NotFoundError("OAuth provider", providerId);
    if (rows[0].appId !== appId) throw new NotFoundError("OAuth provider", providerId);

    await db.delete(oauthProviders).where(eq(oauthProviders.id, providerId));
    logger.info({ appId, providerId }, "OAuth provider deleted");
  }

  // ── API Keys (admin view) ─────────────────────────

  async listAllApiKeys(): Promise<(typeof apiKeys.$inferSelect)[]> {
    return db.select().from(apiKeys);
  }

  async adminDeleteApiKey(keyId: string): Promise<void> {
    const rows = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
    if (rows.length === 0) throw new NotFoundError("API key", keyId);
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
    logger.info({ apiKeyId: keyId }, "API key revoked (admin)");
  }
}

export const adminService = new AdminService();
