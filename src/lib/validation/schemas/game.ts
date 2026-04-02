import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas/common";
import { BOARD_STAKE_TIERS, BOARD_DEFAULT_STAKE_TIER } from "@/modules/game/domain/board.constants";

const BOARD_ALLOWED_QUANTITIES = [1, 5, 25, 100] as const;

export const boardPurchaseQuantitySchema = z
  .coerce
  .number({
    required_error: "La cantidad es obligatoria",
    invalid_type_error: "Cantidad invalida"
  })
  .int()
  .refine((value) => BOARD_ALLOWED_QUANTITIES.includes(value as (typeof BOARD_ALLOWED_QUANTITIES)[number]), {
    message: "Solo puedes comprar 1, 5, 25 o 100 tablas."
  });

export const bingoGridSchema = z
  .array(
    z.array(
      z
        .number({
          invalid_type_error: "La celda debe ser numerica"
        })
        .int("Los valores deben ser enteros")
    ).length(3, "Cada fila debe tener 3 columnas")
  )
  .length(3, "La tabla debe tener 3 filas")
  .superRefine((grid, ctx) => {
    const seen = new Set<number>();

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      for (let colIndex = 0; colIndex < 3; colIndex += 1) {
        const value = grid[rowIndex]?.[colIndex];
        if (typeof value !== "number") {
          continue;
        }

        if (colIndex === 0 && (value < 1 || value > 10)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Columna 1 solo permite numeros del 1 al 10.",
            path: [rowIndex, colIndex]
          });
        }

        if (colIndex === 1 && (value < 11 || value > 20)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Columna 2 solo permite numeros del 11 al 20.",
            path: [rowIndex, colIndex]
          });
        }

        if (colIndex === 2 && (value < 21 || value > 30)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Columna 3 solo permite numeros del 21 al 30.",
            path: [rowIndex, colIndex]
          });
        }

        if (seen.has(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "No se permiten numeros repetidos en la tabla.",
            path: [rowIndex, colIndex]
          });
        } else {
          seen.add(value);
        }
      }
    }

    if (seen.size !== 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La tabla debe contener 9 numeros unicos."
      });
    }
  });

export const purchaseBoardsSchema = z.object({
  quantity: boardPurchaseQuantitySchema,
  stakeTier: z
    .enum(BOARD_STAKE_TIERS, {
      required_error: "Debes seleccionar un nivel de apuesta.",
      invalid_type_error: "Nivel de apuesta invalido."
    })
    .default(BOARD_DEFAULT_STAKE_TIER),
  requestRef: z.string().trim().min(1).max(120).optional()
});

export const boardHistoryQuerySchema = z.object({
  purchasesLimit: z.coerce.number().int().min(1).max(50).default(10),
  boardsLimit: z.coerce.number().int().min(1).max(500).default(150)
});

export const gameRoundStatusSchema = z.enum(["scheduled", "active", "finished"]);

export const createGameRoundSchema = z.object({
  scheduledAt: z.string().trim().min(1).max(40).optional()
});

export const activateGameRoundSchema = z
  .object({
    gameRoundId: uuidSchema,
    luckyBallProbability: z.coerce.number().min(0).max(1).default(0.08),
    extraSpinsP1: z.coerce.number().positive().default(0.78),
    extraSpinsP2: z.coerce.number().positive().default(0.17),
    extraSpinsP3: z.coerce.number().positive().default(0.05)
  })
  .superRefine((data, ctx) => {
    if (data.extraSpinsP3 >= data.extraSpinsP2 || data.extraSpinsP3 >= data.extraSpinsP1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La probabilidad de 3 giros extra debe ser la mas baja.",
        path: ["extraSpinsP3"]
      });
    }
  });

export const finalizeGameRoundSchema = z.object({
  gameRoundId: uuidSchema
});

export const settleGameRoundPrizesSchema = z.object({
  gameRoundId: uuidSchema,
  basePrize: z.coerce
    .number({
      required_error: "El premio base es obligatorio",
      invalid_type_error: "Premio base invalido"
    })
    .positive("El premio base debe ser mayor a cero")
    .max(1000, "El premio base excede el limite permitido")
    .default(0.2)
});

export const gameRoundsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
  status: gameRoundStatusSchema.optional()
});
