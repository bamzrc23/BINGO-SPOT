"use client";

import { useFormStatus } from "react-dom";

import { logoutAction } from "@/modules/auth/application";
import { Button } from "@/components/ui";

type LogoutButtonProps = {
  className?: string;
};

function LogoutSubmitButton({ className }: LogoutButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" size="sm" className={className} disabled={pending}>
      {pending ? "Saliendo..." : "Cerrar sesion"}
    </Button>
  );
}

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <form action={logoutAction}>
      <LogoutSubmitButton className={className} />
    </form>
  );
}
