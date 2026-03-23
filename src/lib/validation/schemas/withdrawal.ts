import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas/common";

const holderIdRegex = /^[0-9]{10,13}$/;
const accountNumberRegex = /^[0-9\-]{6,30}$/;
const ALLOWED_WITHDRAWAL_BANK_NAMES = ["Banco Pichincha", "Banco Guayaquil"] as const;

export const withdrawalStatusSchema = z.enum(["pending", "approved", "paid", "rejected"]);
export const bankAccountTypeSchema = z.enum(["savings", "checking"]);
export const withdrawalBankNameSchema = z.enum(ALLOWED_WITHDRAWAL_BANK_NAMES, {
  invalid_type_error: "Selecciona un banco valido.",
  required_error: "Selecciona un banco."
});

export const withdrawalAmountSchema = z.coerce
  .number({
    required_error: "El monto es obligatorio",
    invalid_type_error: "El monto debe ser numerico"
  })
  .min(10, "El retiro minimo es de $10.00")
  .max(10_000, "El monto excede el limite permitido");

export const withdrawalRequestSchema = z.object({
  bankName: withdrawalBankNameSchema,
  accountType: bankAccountTypeSchema,
  accountNumber: z
    .string()
    .trim()
    .regex(accountNumberRegex, "Numero de cuenta invalido"),
  accountHolderName: z.string().trim().min(3, "El titular es obligatorio").max(120),
  accountHolderId: z
    .string()
    .trim()
    .regex(holderIdRegex, "Cedula invalida"),
  amountRequested: withdrawalAmountSchema
});

export const withdrawalHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: withdrawalStatusSchema.optional()
});

export const withdrawalAdminReviewSchema = z
  .object({
    withdrawalId: uuidSchema,
    decision: z.enum(["approved", "rejected"]),
    observation: z.string().trim().max(300).optional(),
    rejectionReason: z.string().trim().max(300).optional()
  })
  .superRefine((data, ctx) => {
    if (data.decision === "rejected" && !data.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar motivo de rechazo.",
        path: ["rejectionReason"]
      });
    }
  });

export const withdrawalMarkPaidSchema = z.object({
  withdrawalId: uuidSchema,
  observation: z.string().trim().max(300).optional(),
  externalReference: z.string().trim().max(120).optional()
});

export const withdrawalFeeQuoteSchema = z.object({
  bankName: withdrawalBankNameSchema,
  amountRequested: withdrawalAmountSchema
});
