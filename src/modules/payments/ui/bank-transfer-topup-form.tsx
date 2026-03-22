"use client";

import { useActionState, useEffect, useRef } from "react";

import { createBankTransferTopupAction } from "@/modules/payments/application";
import { INITIAL_TOPUP_FORM_STATE } from "@/modules/payments/domain";
import { TopupFieldError } from "@/modules/payments/ui/topup-field-error";
import { TopupFormFeedback } from "@/modules/payments/ui/topup-form-feedback";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";

export function BankTransferTopupForm() {
  const [state, formAction, isPending] = useActionState(
    createBankTransferTopupAction,
    INITIAL_TOPUP_FORM_STATE
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
        <CardTitle>Recargar por transferencia externa</CardTitle>
        <CardDescription>
          Completa la solicitud, sube el comprobante y luego te redirigimos a WhatsApp para enviar
          el codigo de validacion al administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4" encType="multipart/form-data">
          <div className="space-y-1.5">
            <label htmlFor="transfer-amount" className="text-sm font-medium">
              Monto (USD)
            </label>
            <Input
              id="transfer-amount"
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
            <label htmlFor="transfer-reference" className="text-sm font-medium">
              Referencia bancaria (opcional)
            </label>
            <Input
              id="transfer-reference"
              name="clientReference"
              maxLength={120}
              placeholder="Numero de transferencia"
            />
            <TopupFieldError errors={state.fieldErrors?.clientReference} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="transfer-receipt" className="text-sm font-medium">
              Comprobante (JPG, PNG o PDF)
            </label>
            <Input
              id="transfer-receipt"
              name="receiptFile"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
            />
            <TopupFieldError errors={state.fieldErrors?.receiptFile} />
          </div>

          <TopupFormFeedback state={state} />

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creando solicitud..." : "Enviar y continuar por WhatsApp"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
