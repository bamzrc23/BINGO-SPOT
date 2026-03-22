import { z } from "zod";

const nicknameRegex = /^[a-zA-Z0-9_]+$/;
const phoneRegex = /^[0-9+\-\s()]*$/;

export const loginSchema = z.object({
  email: z.string().email("Correo no valido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres")
});

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, "Los nombres son obligatorios").max(80),
    lastName: z.string().trim().min(2, "Los apellidos son obligatorios").max(80),
    nickname: z
      .string()
      .trim()
      .min(3, "El usuario debe tener al menos 3 caracteres")
      .max(30, "El usuario no puede superar 30 caracteres")
      .regex(
        nicknameRegex,
        "El usuario solo puede usar letras, numeros y guion bajo"
      ),
    email: z.string().email("Correo no valido"),
    phone: z
      .string()
      .trim()
      .max(20, "Telefono demasiado largo")
      .regex(phoneRegex, "Telefono no valido")
      .or(z.literal(""))
      .optional(),
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contrasenas no coinciden",
    path: ["confirmPassword"]
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Correo no valido")
});

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(2, "Los nombres son obligatorios").max(80),
  lastName: z.string().trim().min(2, "Los apellidos son obligatorios").max(80),
  nickname: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(30, "El usuario no puede superar 30 caracteres")
    .regex(
      nicknameRegex,
      "El usuario solo puede usar letras, numeros y guion bajo"
    ),
  phone: z
    .string()
    .trim()
    .max(20, "Telefono demasiado largo")
    .regex(phoneRegex, "Telefono no valido")
    .or(z.literal(""))
    .optional()
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contrasenas no coinciden",
    path: ["confirmPassword"]
  });
