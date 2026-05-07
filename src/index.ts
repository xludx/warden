import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "@/util/env";
import { logger } from "@/util/logger";
import { testConnection, closeDb, runMigrations } from "@/db";
import { authRoutes } from "@/routes/auth";
import { adminRoutes } from "@/routes/admin";
import { oauthRoutes } from "@/routes/oauth";

await runMigrations();
await testConnection();

const app = new Elysia()
  .use(cors({ origin: true, credentials: true }))
  .use(authRoutes)
  .use(adminRoutes)
  .use(oauthRoutes)
  .get("/", () => "Warden Auth Service")
  .listen(env.PORT);

logger.info({ port: env.PORT }, "Warden Auth Service running");

process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await closeDb();
  process.exit(0);
});
