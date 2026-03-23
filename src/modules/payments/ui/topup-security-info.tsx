import {
  AUTHORIZED_TOPUP_BANK_ACCOUNTS,
  TOPUP_ACCREDITATION_WINDOW_TEXT,
  TOPUP_ACCOUNT_HOLDER
} from "@/modules/payments/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export function TopupSecurityInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RECARGAS SEGURAS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Todas las recargas deben realizarse unicamente desde esta pagina.</p>
        <p className="font-semibold text-danger">
          No envies dinero a terceros (riesgo de estafa).
        </p>

        <div className="space-y-1">
          <p className="font-semibold">TRANSFERENCIA A CUALQUIERA DE LAS SIGUIENTES CUENTAS.</p>
          <p className="font-semibold">Cuentas autorizadas:</p>
          {AUTHORIZED_TOPUP_BANK_ACCOUNTS.map((account) => (
            <p key={`${account.bankName}-${account.accountNumber}`}>
              {account.bankName} - {account.accountType} #{account.accountNumber}
            </p>
          ))}
          <p>
            {TOPUP_ACCOUNT_HOLDER.fullName} - {TOPUP_ACCOUNT_HOLDER.documentLabel}:{" "}
            {TOPUP_ACCOUNT_HOLDER.documentNumber}
          </p>
        </div>

        <p>Ingresa el valor exacto y el motivo de tu recarga.</p>
        <p>
          Una vez enviado el comprobante por WhatsApp se acredita tu saldo de{" "}
          {TOPUP_ACCREDITATION_WINDOW_TEXT}.
        </p>
      </CardContent>
    </Card>
  );
}
