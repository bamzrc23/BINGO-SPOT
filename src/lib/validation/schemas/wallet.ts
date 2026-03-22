import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas/common";

export const walletMovementTypeSchema = z.enum([
  "topup",
  "prize",
  "board_purchase",
  "withdrawal",
  "admin_adjustment"
]);

export const walletDirectionSchema = z.enum(["credit", "debit"]);

export const applyWalletTransactionSchema = z
  .object({
    userId: uuidSchema,
    movementType: walletMovementTypeSchema,
    direction: walletDirectionSchema,
    amount: z
      .number({
        required_error: "El monto es obligatorio",
        invalid_type_error: "El monto debe ser numerico"
      })
      .positive("El monto debe ser mayor a cero")
      .max(1_000_000, "El monto excede el limite permitido"),
    operationRef: z.string().trim().min(1).max(120).optional(),
    operationSource: z.string().trim().min(1).max(80).default("system"),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .superRefine((data, ctx) => {
    if ((data.movementType === "topup" || data.movementType === "prize") && data.direction !== "credit") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Este tipo de movimiento solo permite credito.",
        path: ["direction"]
      });
    }

    if (
      (data.movementType === "board_purchase" || data.movementType === "withdrawal") &&
      data.direction !== "debit"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Este tipo de movimiento solo permite debito.",
        path: ["direction"]
      });
    }
  });

export const walletHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
