import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  BANK_ACCOUNT_TYPE_LABELS,
  getWithdrawalVerificationCode,
  type WithdrawalRow
} from "@/modules/withdrawals/domain";
import { WithdrawalStatusBadge } from "@/modules/withdrawals/ui/withdrawal-status-badge";

type UserWithdrawalsTableProps = {
  withdrawals: WithdrawalRow[];
};

function maskAccount(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length <= 4) {
    return accountNumber;
  }

  return `****${digits.slice(-4)}`;
}

export function UserWithdrawalsTable({ withdrawals }: UserWithdrawalsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de retiros</CardTitle>
      </CardHeader>
      <CardContent>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aun no tienes solicitudes de retiro registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Codigo</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Banco</th>
                  <th className="px-2 py-2 font-medium">Cuenta</th>
                  <th className="px-2 py-2 font-medium">Solicitado</th>
                  <th className="px-2 py-2 font-medium">Comision</th>
                  <th className="px-2 py-2 font-medium">Neto</th>
                  <th className="px-2 py-2 font-medium">Observacion</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((withdrawal) => {
                  const verificationCode = getWithdrawalVerificationCode(withdrawal);

                  return (
                    <tr key={withdrawal.id} className="border-b border-border/60 align-top">
                      <td className="px-2 py-2">{formatDateTime(withdrawal.createdAt)}</td>
                      <td className="px-2 py-2 font-medium">{verificationCode ?? "-"}</td>
                      <td className="px-2 py-2">
                        <WithdrawalStatusBadge status={withdrawal.status} />
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-medium">{withdrawal.bankName}</p>
                        <p className="text-xs text-muted-foreground">
                          {BANK_ACCOUNT_TYPE_LABELS[withdrawal.accountType]}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {maskAccount(withdrawal.accountNumber)}
                      </td>
                      <td className="px-2 py-2 font-medium">
                        {formatCurrency(withdrawal.amountRequested)}
                      </td>
                      <td className="px-2 py-2 text-danger">
                        {withdrawal.feeApplied > 0
                          ? `-${formatCurrency(withdrawal.feeApplied)}`
                          : formatCurrency(0)}
                      </td>
                      <td className="px-2 py-2 font-medium text-success">
                        {formatCurrency(withdrawal.amountNet)}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {withdrawal.status === "rejected"
                          ? withdrawal.rejectionReason
                          : withdrawal.adminObservation ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
