import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/util/env";
import { logger } from "@/util/logger";

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });

export async function closeDb(): Promise<void> {
  await client.end();
}

export async function testConnection(): Promise<void> {
  const result = await client`SELECT 1 as ok`;
  if (result[0]?.ok !== 1) {
    throw new Error("Database connection test failed");
  }
  logger.info("Database connection established");
}
