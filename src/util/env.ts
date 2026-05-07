import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().transform(Number).default("3210"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.string().transform(Number).default("12"),
  PUBLIC_URL: z.string().url().optional(),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_RP_NAME: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
