import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  appId: z.string().min(1),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  appId: z.string().min(1),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  appId: z.string().min(1),
});

export const ClientCredentialsSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  grant_type: z.literal("client_credentials"),
  audience: z.string().min(1),
});

export const VerifySchema = z.object({
  apiKey: z.string().min(1),
});

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeySchema>;
export type ClientCredentialsRequest = z.infer<typeof ClientCredentialsSchema>;
