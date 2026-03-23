import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas/common";

export const topupStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const topupProviderSchema = z.enum(["payphone", "bank_transfer"]);

export const topupAmountSchema = z.coerce
  .number({
    required_error: "El monto es obligatorio",
    invalid_type_error: "El monto debe ser numerico"
  })
  .positive("El monto debe ser mayor a cero")
  .max(10_000, "El monto supera el limite permitido");

export const topupReferenceSchema = z.string().trim().max(120).optional();
export const rejectionReasonSchema = z
  .string()
  .trim()
  .min(5, "El motivo debe tener al menos 5 caracteres")
  .max(300, "El motivo no puede superar 300 caracteres");

export const createPayphoneTopupSchema = z.object({
  amount: topupAmountSchema,
  clientReference: topupReferenceSchema
});

export const createBankTransferTopupSchema = z.object({
  amount: topupAmountSchema,
  clientReference: topupReferenceSchema,
  receiptPath: z.string().trim().max(255).optional()
});

export const topupHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export const adminTopupReviewSchema = z
  .object({
    topupId: uuidSchema,
    decision: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().max(300).optional()
  })
  .superRefine((data, ctx) => {
    if (data.decision === "rejected" && !data.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar un motivo para rechazar la recarga.",
        path: ["rejectionReason"]
      });
    }
  });

export const payphoneWebhookResultSchema = z
  .object({
    topupId: uuidSchema,
    approved: z.boolean(),
    providerReference: z.string().trim().max(120).optional(),
    rejectionReason: z.string().trim().max(300).optional(),
    payload: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((data, ctx) => {
    if (!data.approved && !data.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El rechazo requiere motivo.",
        path: ["rejectionReason"]
      });
    }
  });
