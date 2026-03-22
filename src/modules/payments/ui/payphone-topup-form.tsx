"use client";

import { useActionState } from "react";

import { createPayphoneTopupAction } from "@/modules/payments/application";
import { INITIAL_TOPUP_FORM_STATE } from "@/modules/payments/domain";
import { TopupFieldError } from "@/modules/payments/ui/topup-field-error";
import { TopupFormFeedback } from "@/modules/payments/ui/topup-form-feedback";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";

export function PayphoneTopupForm() {
  const [state, formAction, isPending] = useActionState(
    createPayphoneTopupAction,
    INITIAL_TOPUP_FORM_STATE
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recargar con PayPhone</CardTitle>
        <CardDescription>
          Registra la intencion de pago. El saldo se acredita automaticamente cuando PayPhone confirme
          la transaccion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="payphone-amount" className="text-sm font-medium">
              Monto (USD)
            </label>
            <Input
              id="payphone-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="10.00"
              required
            />
            <TopupFieldError errors={state.fieldErrors?.amount} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="payphone-reference" className="text-sm font-medium">
              Referencia interna (opcional)
            </label>
            <Input
              id="payphone-reference"
              name="clientReference"
              maxLength={120}
              placeholder="Ej: recarga-marzo-01"
            />
            <TopupFieldError errors={state.fieldErrors?.clientReference} />
          </div>

          <TopupFormFeedback state={state} />

          <Button type="submit" disabled={isPending}>
            {isPending ? "Procesando..." : "Iniciar recarga PayPhone"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
