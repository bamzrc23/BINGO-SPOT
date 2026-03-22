"use client";

import { useActionState, useEffect, useRef } from "react";

import { createWithdrawalRequestAction } from "@/modules/withdrawals/application";
import { INITIAL_WITHDRAWAL_FORM_STATE } from "@/modules/withdrawals/domain";
import { WithdrawalFieldError } from "@/modules/withdrawals/ui/withdrawal-field-error";
import { WithdrawalFormFeedback } from "@/modules/withdrawals/ui/withdrawal-form-feedback";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";

export function WithdrawalRequestForm() {
  const [state, formAction, isPending] = useActionState(
    createWithdrawalRequestAction,
    INITIAL_WITHDRAWAL_FORM_STATE
  );
  const redirectedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== "success" || !state.redirectUrl) {
      return;
    }

    if (redirectedUrlRef.current === state.redirectUrl) {
      return;
    }

    redirectedUrlRef.current = state.redirectUrl;
    window.location.assign(state.redirectUrl);
  }, [state.redirectUrl, state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitar retiro</CardTitle>
        <CardDescription>
          Banco Pichincha y Banco Guayaquil no aplican comision. Otros bancos descuentan comision
          interbancaria. Al enviar, te redirigimos a WhatsApp para reportar el codigo de
          validacion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="withdrawal-bankName" className="text-sm font-medium">
              Banco
            </label>
            <Input
              id="withdrawal-bankName"
              name="bankName"
              list="withdrawal-bank-options"
              placeholder="Ej: Banco Pichincha"
              required
            />
            <datalist id="withdrawal-bank-options">
              <option value="Banco Pichincha" />
              <option value="Banco Guayaquil" />
            </datalist>
            <WithdrawalFieldError errors={state.fieldErrors?.bankName} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="withdrawal-accountType" className="text-sm font-medium">
              Tipo de cuenta
            </label>
            <select
              id="withdrawal-accountType"
              name="accountType"
              className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30"
              required
              defaultValue="savings"
            >
              <option value="savings">Ahorros</option>
              <option value="checking">Corriente</option>
            </select>
            <WithdrawalFieldError errors={state.fieldErrors?.accountType} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="withdrawal-accountNumber" className="text-sm font-medium">
                Numero de cuenta
              </label>
              <Input
                id="withdrawal-accountNumber"
                name="accountNumber"
                placeholder="000123456789"
                required
              />
              <WithdrawalFieldError errors={state.fieldErrors?.accountNumber} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="withdrawal-accountHolderId" className="text-sm font-medium">
                Cedula
              </label>
              <Input
                id="withdrawal-accountHolderId"
                name="accountHolderId"
                inputMode="numeric"
                placeholder="0102030405"
                required
              />
              <WithdrawalFieldError errors={state.fieldErrors?.accountHolderId} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="withdrawal-accountHolderName" className="text-sm font-medium">
              Nombre del titular
            </label>
            <Input
              id="withdrawal-accountHolderName"
              name="accountHolderName"
              placeholder="Nombres y apellidos"
              required
            />
            <WithdrawalFieldError errors={state.fieldErrors?.accountHolderName} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="withdrawal-amountRequested" className="text-sm font-medium">
              Monto solicitado (USD)
            </label>
            <Input
              id="withdrawal-amountRequested"
              name="amountRequested"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="20.00"
              required
            />
            <WithdrawalFieldError errors={state.fieldErrors?.amountRequested} />
          </div>

          <WithdrawalFormFeedback state={state} />

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creando solicitud..." : "Solicitar y continuar por WhatsApp"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
