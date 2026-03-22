"use client";

import { useActionState } from "react";

import { updateProfileAction } from "@/modules/auth/application";
import {
  INITIAL_AUTH_FORM_STATE,
  type ProfileFormDefaults
} from "@/modules/auth/domain";
import { FieldError } from "@/modules/auth/ui/field-error";
import { FormFeedback } from "@/modules/auth/ui/form-feedback";
import { Button, Input } from "@/components/ui";

type ProfileFormProps = {
  defaults: ProfileFormDefaults;
};

export function ProfileForm({ defaults }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    INITIAL_AUTH_FORM_STATE
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="text-sm font-medium">
            Nombres
          </label>
          <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required />
          <FieldError errors={state.fieldErrors?.firstName} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lastName" className="text-sm font-medium">
            Apellidos
          </label>
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required />
          <FieldError errors={state.fieldErrors?.lastName} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nickname" className="text-sm font-medium">
          Usuario o nickname
        </label>
        <Input id="nickname" name="nickname" defaultValue={defaults.nickname} required />
        <FieldError errors={state.fieldErrors?.nickname} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <Input id="email" name="email" defaultValue={defaults.email} disabled />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Telefono
        </label>
        <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} />
        <FieldError errors={state.fieldErrors?.phone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Estado</label>
          <Input value={defaults.accountStatus} disabled />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rol</label>
          <Input value={defaults.role} disabled />
        </div>
      </div>

      <FormFeedback state={state} />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
