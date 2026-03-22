"use client";

import { useActionState } from "react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { loginAction } from "@/modules/auth/application";
import { INITIAL_AUTH_FORM_STATE } from "@/modules/auth/domain";
import { FieldError } from "@/modules/auth/ui/field-error";
import { FormFeedback } from "@/modules/auth/ui/form-feedback";
import { Button, Input } from "@/components/ui";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "" }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_AUTH_FORM_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError errors={state.fieldErrors?.email} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contrasena
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError errors={state.fieldErrors?.password} />
      </div>

      <FormFeedback state={state} />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Entrando..." : "Entrar"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link href={ROUTES.forgotPassword} className="text-primary hover:underline">
          Olvide mi contrasena
        </Link>
        <Link href={ROUTES.register} className="text-primary hover:underline">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
