"use client";

import { useActionState } from "react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { registerAction } from "@/modules/auth/application";
import { INITIAL_AUTH_FORM_STATE } from "@/modules/auth/domain";
import { FieldError } from "@/modules/auth/ui/field-error";
import { FormFeedback } from "@/modules/auth/ui/form-feedback";
import { Button, Input } from "@/components/ui";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, INITIAL_AUTH_FORM_STATE);
  const normalizedMessage = state.message?.toLowerCase() ?? "";
  const emailErrors = state.fieldErrors?.email ?? [];
  const nicknameErrors = state.fieldErrors?.nickname ?? [];
  const duplicateEmailDetected =
    normalizedMessage.includes("correo ya esta registrado") ||
    emailErrors.some((error) => {
      const normalized = error.toLowerCase();
      return normalized.includes("registrado") || normalized.includes("usa otro correo");
    });
  const duplicateNicknameDetected =
    normalizedMessage.includes("usuario ya esta en uso") ||
    nicknameErrors.some((error) => {
      const normalized = error.toLowerCase();
      return normalized.includes("en uso") || normalized.includes("otro usuario");
    });

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="text-sm font-medium">
            Nombres
          </label>
          <Input id="firstName" name="firstName" required />
          <FieldError errors={state.fieldErrors?.firstName} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lastName" className="text-sm font-medium">
            Apellidos
          </label>
          <Input id="lastName" name="lastName" required />
          <FieldError errors={state.fieldErrors?.lastName} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nickname" className="text-sm font-medium">
          Usuario o nickname
        </label>
        <Input id="nickname" name="nickname" required />
        <FieldError errors={state.fieldErrors?.nickname} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      {duplicateEmailDetected ? (
        <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <p className="font-semibold">Correo ya registrado.</p>
          <p>Ese correo ya tiene una cuenta. Inicia sesion o recupera tu contrasena.</p>
          <div className="flex flex-wrap gap-3">
            <Link href={ROUTES.login} className="font-semibold underline underline-offset-2">
              Ir a iniciar sesion
            </Link>
            <Link
              href={ROUTES.forgotPassword}
              className="font-semibold underline underline-offset-2"
            >
              Recuperar contrasena
            </Link>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Telefono
        </label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        <FieldError errors={state.fieldErrors?.phone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Contrasena
          </label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <FieldError errors={state.fieldErrors?.password} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirmar contrasena
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError errors={state.fieldErrors?.confirmPassword} />
        </div>
      </div>

      {duplicateNicknameDetected ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <p className="font-semibold">Usuario o nickname en uso.</p>
          <p>Elige otro nombre de usuario para completar el registro.</p>
        </div>
      ) : null}

      <FormFeedback state={state} />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Registrando..." : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ya tienes cuenta?{" "}
        <Link href={ROUTES.login} className="text-primary hover:underline">
          Inicia sesion
        </Link>
      </p>
    </form>
  );
}
