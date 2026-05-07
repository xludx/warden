import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, credentials, applications, memberships } from "@/db/schema";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { logger } from "@/util/logger";

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.error("Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret bun run src/scripts/seed-superadmin.ts");
    process.exit(1);
  }

  // Create warden application
  let wardenAppId: string;
  const existingApp = await db.select().from(applications).where(eq(applications.slug, "warden")).limit(1);

  if (existingApp.length > 0) {
    wardenAppId = existingApp[0].id;
    // Ensure registration stays disabled for the control-plane app
    await db.update(applications).set({ allowRegistration: false }).where(eq(applications.id, wardenAppId));
    logger.info("Warden application already exists, ensured registration is disabled");
  } else {
    wardenAppId = nanoid();
    await db.insert(applications).values({
      id: wardenAppId,
      name: "Warden",
      slug: "warden",
      jwtSecret: nanoid(48),
      allowRegistration: false,
    });
    logger.info({ appId: wardenAppId }, "Warden application created");
  }

  // Create or repair admin user
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  const userId = existingUser[0]?.id ?? nanoid();

  if (existingUser.length > 0) {
    logger.info({ email }, "Admin user already exists");
  } else {
    await db.insert(users).values({ id: userId, email, name, type: "human" });
    logger.info({ userId, email }, "Admin user created");
  }

  const existingCredential = await db.select({ id: credentials.id }).from(credentials).where(eq(credentials.userId, userId)).limit(1);
  if (existingCredential.length === 0) {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(credentials).values({
      id: nanoid(),
      userId,
      type: "password",
      provider: "password",
      credentialData: { password_hash: passwordHash },
    });
    logger.info({ userId, email }, "Admin password credential created");
  }

  const existingMembership = await db.select({ id: memberships.id }).from(memberships).where(
    and(eq(memberships.userId, userId), eq(memberships.appId, wardenAppId)),
  ).limit(1);
  if (existingMembership.length === 0) {
    await db.insert(memberships).values({
      id: nanoid(),
      userId,
      appId: wardenAppId,
      role: "admin",
    });
    logger.info({ userId, appId: wardenAppId }, "Admin Warden membership created");
  }

  process.exit(0);
}

seed();
