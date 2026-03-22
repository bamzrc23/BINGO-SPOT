import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const amountSchema = z
  .number({
    required_error: "El monto es obligatorio",
    invalid_type_error: "El monto debe ser numerico"
  })
  .positive("El monto debe ser mayor a cero");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const idParamSchema = z.object({
  id: uuidSchema
});
