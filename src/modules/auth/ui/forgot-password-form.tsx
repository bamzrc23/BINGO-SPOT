"use client";

import { useActionState } from "react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { forgotPasswordAction } from "@/modules/auth/application";
import { INITIAL_AUTH_FORM_STATE } from "@/modules/auth/domain";
import { FieldError } from "@/modules/auth/ui/field-error";
import { FormFeedback } from "@/modules/auth/ui/form-feedback";
import { Button, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    INITIAL_AUTH_FORM_STATE
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      <FormFeedback state={state} />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Enviando..." : "Enviar enlace"}
      </Button>

      <Link href={ROUTES.login} className="block text-center text-sm text-primary hover:underline">
        Volver a inicio de sesion
      </Link>
    </form>
  );
}
