import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { nanoid } from "nanoid";
import { logger } from "@/util/logger";

export type AuditAction =
  | "user.registered"
  | "user.login"
  | "user.login_failed"
  | "user.deleted"
  | "user.password_changed"
  | "application.created"
  | "application.deleted"
  | "application.secret_rotated"
  | "membership.added"
  | "membership.removed"
  | "api_key.created"
  | "api_key.revoked"
  | "api_key.verified"
  | "service_account.created"
  | "service_account.deleted"
  | "service_grant.added"
  | "service_grant.removed"
  | "token.client_credentials"
  | "oauth.started"
  | "oauth.callback"
  | "passkey.registered"
  | "passkey.authenticated";

type AuditInput = {
  action: AuditAction | string;
  actorId?: string | null;
  actorType?: "human" | "service" | "system" | null;
  actorName?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  appId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

class AuditService {
  async log(input: AuditInput): Promise<void> {
    try {
      await db.insert(auditEvents).values({
        id: nanoid(),
        action: input.action,
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? null,
        actorName: input.actorName ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetName: input.targetName ?? null,
        appId: input.appId ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.ipAddress ?? null,
      });
    } catch (err) {
      // Audit logging should never break the main flow
      logger.error({ err, action: input.action }, "Failed to write audit event");
    }
  }

  async list(options: {
    limit?: number;
    offset?: number;
    action?: string;
    actorId?: string;
    targetType?: string;
    appId?: string;
  }): Promise<{ events: (typeof auditEvents.$inferSelect)[]; total: number }> {
    const { eq, desc, sql, and } = await import("drizzle-orm");

    const conditions = [];
    if (options.action) conditions.push(eq(auditEvents.action, options.action));
    if (options.actorId) conditions.push(eq(auditEvents.actorId, options.actorId));
    if (options.targetType) conditions.push(eq(auditEvents.targetType, options.targetType));
    if (options.appId) conditions.push(eq(auditEvents.appId, options.appId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = Math.min(options.limit ?? 100, 500);
    const offset = options.offset ?? 0;

    const [events, countResult] = await Promise.all([
      db.select().from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(auditEvents).where(where),
    ]);

    return { events, total: countResult[0]?.count ?? 0 };
  }
}

export const auditService = new AuditService();
