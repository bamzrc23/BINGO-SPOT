"use client";

import { useActionState, useMemo, useState } from "react";

import { reviewBankTransferTopupAction } from "@/modules/payments/application";
import { INITIAL_TOPUP_FORM_STATE, type TopupRowWithReceiptUrl } from "@/modules/payments/domain";
import { TopupFormFeedback } from "@/modules/payments/ui/topup-form-feedback";
import { TopupStatusBadge } from "@/modules/payments/ui/topup-status-badge";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type AdminBankTransferTopupsTableProps = {
  topups: TopupRowWithReceiptUrl[];
};

export function AdminBankTransferTopupsTable({ topups }: AdminBankTransferTopupsTableProps) {
  const [state, formAction, isPending] = useActionState(
    reviewBankTransferTopupAction,
    INITIAL_TOPUP_FORM_STATE
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "all"
  );
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTopups = useMemo(() => {
    return topups.filter((topup) => {
      if (statusFilter !== "all" && topup.status !== statusFilter) {
        return false;
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        topup.id,
        topup.clientReference ?? "",
        topup.providerReference ?? "",
        String(topup.amount),
        topup.userId
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [searchTerm, statusFilter, topups]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recargas por transferencia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TopupFormFeedback state={state} />
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por ID, codigo, monto o usuario"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | "pending" | "approved" | "rejected")
            }
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        </div>

        {filteredTopups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay solicitudes que coincidan con los filtros actuales.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredTopups.map((topup) => (
              <form
                key={topup.id}
                action={formAction}
                className="rounded-xl border border-border p-4"
                onSubmit={(event) => {
                  const submitter = (event.nativeEvent as SubmitEvent)
                    .submitter as HTMLButtonElement | null;
                  if (!submitter) {
                    return;
                  }

                  const isApprove = submitter.value === "approved";
                  const message = isApprove
                    ? "Confirma aprobar esta recarga?"
                    : "Confirma rechazar esta recarga?";

                  if (!window.confirm(message)) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="topupId" value={topup.id} />
                <div className="grid gap-4 md:grid-cols-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Creada</p>
                    <p className="text-sm font-medium">{formatDateTime(topup.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monto</p>
                    <p className="text-sm font-medium">{formatCurrency(topup.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <TopupStatusBadge status={topup.status} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Codigo</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {topup.clientReference ?? topup.providerReference ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Comprobante</p>
                    {topup.receiptSignedUrl ? (
                      <a
                        href={topup.receiptSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Ver archivo
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">No disponible</p>
                    )}
                  </div>
                </div>

                {topup.status === "pending" ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                    <Input
                      name="rejectionReason"
                      placeholder="Motivo de rechazo (obligatorio si rechazas)"
                    />
                    <Button
                      type="submit"
                      name="decision"
                      value="approved"
                      disabled={isPending}
                    >
                      Aprobar
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="rejected"
                      variant="danger"
                      disabled={isPending}
                    >
                      Rechazar
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Esta solicitud ya fue procesada.
                  </p>
                )}
              </form>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
