import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas/common";

export const adminRoleSchema = z.enum(["user", "admin"]);
export const adminAccountStatusSchema = z.enum(["pending", "active", "suspended"]);

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: adminRoleSchema.optional(),
  accountStatus: adminAccountStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).max(5000).default(0)
});

export const adminSetUserStatusSchema = z.object({
  userId: uuidSchema,
  accountStatus: adminAccountStatusSchema,
  reason: z.string().trim().max(240).optional()
});

export const adminWalletQuerySchema = z.object({
  userId: uuidSchema,
  limit: z.coerce.number().int().min(1).max(200).default(30)
});

export const adminAuditQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(300).default(120),
  offset: z.coerce.number().int().min(0).max(5000).default(0)
});

export const adminUpsertGameSettingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "La clave es obligatoria.")
    .max(80, "La clave excede el limite permitido.")
    .regex(/^[a-z0-9_.-]+$/, "La clave solo puede contener a-z, 0-9, ., _ o -."),
  value: z
    .string()
    .trim()
    .min(1, "El valor es obligatorio.")
    .max(2000, "El valor excede el limite permitido."),
  description: z.string().trim().max(180).optional()
});
