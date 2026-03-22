"use client";

import { useActionState, useMemo, useState } from "react";

import {
  markWithdrawalPaidAction,
  reviewWithdrawalAction
} from "@/modules/withdrawals/application";
import {
  BANK_ACCOUNT_TYPE_LABELS,
  INITIAL_WITHDRAWAL_FORM_STATE,
  getWithdrawalVerificationCode,
  type WithdrawalRow
} from "@/modules/withdrawals/domain";
import { WithdrawalFormFeedback } from "@/modules/withdrawals/ui/withdrawal-form-feedback";
import { WithdrawalStatusBadge } from "@/modules/withdrawals/ui/withdrawal-status-badge";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type AdminWithdrawalsTableProps = {
  withdrawals: WithdrawalRow[];
};

export function AdminWithdrawalsTable({ withdrawals }: AdminWithdrawalsTableProps) {
  const [reviewState, reviewAction, isReviewPending] = useActionState(
    reviewWithdrawalAction,
    INITIAL_WITHDRAWAL_FORM_STATE
  );
  const [paidState, paidAction, isPaidPending] = useActionState(
    markWithdrawalPaidAction,
    INITIAL_WITHDRAWAL_FORM_STATE
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "paid" | "rejected"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((withdrawal) => {
      if (statusFilter !== "all" && withdrawal.status !== statusFilter) {
        return false;
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        withdrawal.id,
        getWithdrawalVerificationCode(withdrawal) ?? "",
        withdrawal.userId,
        withdrawal.bankName,
        withdrawal.accountHolderName,
        withdrawal.accountHolderId,
        withdrawal.accountNumber
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [searchTerm, statusFilter, withdrawals]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bandeja de retiros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <WithdrawalFormFeedback state={reviewState} />
        <WithdrawalFormFeedback state={paidState} />
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por ID, usuario, banco o titular"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "pending" | "approved" | "paid" | "rejected"
              )
            }
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="paid">Pagados</option>
            <option value="rejected">Rechazados</option>
          </select>
        </div>

        {filteredWithdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay solicitudes que coincidan con los filtros actuales.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredWithdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="rounded-xl border border-border p-4">
                <div className="grid gap-4 md:grid-cols-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Creado</p>
                    <p className="text-sm font-medium">{formatDateTime(withdrawal.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <WithdrawalStatusBadge status={withdrawal.status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Usuario</p>
                    <p className="text-sm font-medium">{withdrawal.userId.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      Cod: {getWithdrawalVerificationCode(withdrawal) ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Banco</p>
                    <p className="text-sm font-medium">{withdrawal.bankName}</p>
                    <p className="text-xs text-muted-foreground">
                      {BANK_ACCOUNT_TYPE_LABELS[withdrawal.accountType]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Solicitado</p>
                    <p className="text-sm font-medium">{formatCurrency(withdrawal.amountRequested)}</p>
                    <p className="text-xs text-danger">Comision: {formatCurrency(withdrawal.feeApplied)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Neto</p>
                    <p className="text-sm font-semibold text-success">
                      {formatCurrency(withdrawal.amountNet)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>
                    Titular: <span className="text-foreground">{withdrawal.accountHolderName}</span>
                  </p>
                  <p>
                    Cedula: <span className="text-foreground">{withdrawal.accountHolderId}</span>
                  </p>
                  <p>
                    Cuenta: <span className="text-foreground">{withdrawal.accountNumber}</span>
                  </p>
                  <p>
                    Referencia externa:{" "}
                    <span className="text-foreground">{withdrawal.externalReference ?? "-"}</span>
                  </p>
                </div>

                {withdrawal.status === "pending" ? (
                  <form
                    action={reviewAction}
                    className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
                    onSubmit={(event) => {
                      const submitter = (event.nativeEvent as SubmitEvent)
                        .submitter as HTMLButtonElement | null;
                      if (!submitter) {
                        return;
                      }

                      const message =
                        submitter.value === "approved"
                          ? "Confirma aprobar este retiro?"
                          : "Confirma rechazar este retiro?";
                      if (!window.confirm(message)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="withdrawalId" value={withdrawal.id} />
                    <Input name="observation" placeholder="Observacion administrativa (opcional)" />
                    <Input name="rejectionReason" placeholder="Motivo rechazo (solo si rechazas)" />
                    <Button
                      type="submit"
                      name="decision"
                      value="approved"
                      disabled={isReviewPending}
                    >
                      Aprobar
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="rejected"
                      variant="danger"
                      disabled={isReviewPending}
                    >
                      Rechazar
                    </Button>
                  </form>
                ) : null}

                {withdrawal.status === "approved" ? (
                  <form
                    action={paidAction}
                    className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                    onSubmit={(event) => {
                      if (!window.confirm("Confirma marcar este retiro como pagado?")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="withdrawalId" value={withdrawal.id} />
                    <Input name="observation" placeholder="Observacion de pago (opcional)" />
                    <Input name="externalReference" placeholder="Referencia de transferencia" />
                    <Button type="submit" disabled={isPaidPending}>
                      Marcar pagado
                    </Button>
                  </form>
                ) : null}

                {withdrawal.status === "rejected" ? (
                  <p className="mt-3 text-sm text-danger">
                    Motivo rechazo: {withdrawal.rejectionReason}
                  </p>
                ) : null}

                {withdrawal.status === "paid" ? (
                  <p className="mt-3 text-sm text-success">
                    Pagado en {withdrawal.paidAt ? formatDateTime(withdrawal.paidAt) : "-"}.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
