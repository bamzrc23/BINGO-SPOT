"use client";

import { useActionState } from "react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { resetPasswordAction } from "@/modules/auth/application";
import { INITIAL_AUTH_FORM_STATE } from "@/modules/auth/domain";
import { FieldError } from "@/modules/auth/ui/field-error";
import { FormFeedback } from "@/modules/auth/ui/form-feedback";
import { Button, Input } from "@/components/ui";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    INITIAL_AUTH_FORM_STATE
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Nueva contrasena
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

      <FormFeedback state={state} />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Actualizando..." : "Actualizar contrasena"}
      </Button>

      <Link href={ROUTES.login} className="block text-center text-sm text-primary hover:underline">
        Volver a inicio de sesion
      </Link>
    </form>
  );
}
