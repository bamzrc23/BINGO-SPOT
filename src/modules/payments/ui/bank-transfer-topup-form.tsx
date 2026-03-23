"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { INITIAL_TOPUP_FORM_STATE, type TopupFormState } from "@/modules/payments/domain";
import { TopupFieldError } from "@/modules/payments/ui/topup-field-error";
import { TopupFormFeedback } from "@/modules/payments/ui/topup-form-feedback";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";

type TopupApiResponse = TopupFormState;

export function BankTransferTopupForm() {
  const [state, setState] = useState<TopupFormState>(INITIAL_TOPUP_FORM_STATE);
  const [isPending, setIsPending] = useState(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const amountRaw = formData.get("amount");
    const amount = typeof amountRaw === "string" ? Number(amountRaw) : NaN;

    if (!Number.isFinite(amount) || amount <= 0) {
      setState({
        status: "error",
        message: "Ingresa un monto valido mayor a 0.",
        fieldErrors: {
          amount: ["El monto debe ser mayor a 0."]
        }
      });
      return;
    }

    setIsPending(true);
    setState(INITIAL_TOPUP_FORM_STATE);

    try {
      const response = await fetch("/api/topups/bank-transfer", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as TopupApiResponse;

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.message ?? "No se pudo crear la solicitud de transferencia.",
          fieldErrors: payload.fieldErrors
        });
        return;
      }

      setState(payload);

      if (payload.status === "success") {
        form.reset();
      }
    } catch {
      setState({
        status: "error",
        message:
          "No se pudo enviar la solicitud. Revisa tu conexion e intenta nuevamente."
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recargar por transferencia externa</CardTitle>
        <CardDescription>
          Completa la solicitud y te redirigimos a WhatsApp para enviar el codigo de validacion al
          administrador junto con tu comprobante.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            <label htmlFor="transfer-reason" className="text-sm font-medium">
              Motivo
            </label>
            <Input
              id="transfer-reason"
              name="reason"
              maxLength={300}
              placeholder="Ejemplo: Recarga para partida nocturna"
              required
            />
            <TopupFieldError errors={state.fieldErrors?.reason} />
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

          <TopupFormFeedback state={state} />

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creando solicitud..." : "Enviar y continuar por WhatsApp"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
