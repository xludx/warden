import { z } from "zod";

export const CreateApplicationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  allowRegistration: z.boolean().optional(),
});

export const AddMembershipSchema = z.object({
  appId: z.string().min(1),
  role: z.string().min(1).max(100).default("viewer"),
});

export const RemoveMembershipSchema = z.object({
  appId: z.string().min(1),
});

export const CreateServiceAccountSchema = z.object({
  name: z.string().min(1).max(255),
  appId: z.string().min(1),
});

export const AddServiceGrantSchema = z.object({
  targetAppId: z.string().min(1),
  scopes: z.array(z.string()).min(1),
});

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateApplicationRequest = z.infer<typeof CreateApplicationSchema>;
