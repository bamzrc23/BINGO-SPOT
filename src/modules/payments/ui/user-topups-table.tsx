import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TOPUP_PROVIDER_LABELS, type TopupRowWithReceiptUrl } from "@/modules/payments/domain";
import { TopupStatusBadge } from "@/modules/payments/ui/topup-status-badge";

type UserTopupsTableProps = {
  topups: TopupRowWithReceiptUrl[];
};

export function UserTopupsTable({ topups }: UserTopupsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de recargas</CardTitle>
      </CardHeader>
      <CardContent>
        {topups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no tienes recargas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Metodo</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Monto</th>
                  <th className="px-2 py-2 font-medium">Codigo</th>
                  <th className="px-2 py-2 font-medium">Comprobante</th>
                  <th className="px-2 py-2 font-medium">Motivo rechazo</th>
                </tr>
              </thead>
              <tbody>
                {topups.map((topup) => (
                  <tr key={topup.id} className="border-b border-border/60 align-top">
                    <td className="px-2 py-2">{formatDateTime(topup.createdAt)}</td>
                    <td className="px-2 py-2">{TOPUP_PROVIDER_LABELS[topup.provider]}</td>
                    <td className="px-2 py-2">
                      <TopupStatusBadge status={topup.status} />
                    </td>
                    <td className="px-2 py-2 font-medium">{formatCurrency(topup.amount)}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {topup.providerReference ?? topup.clientReference ?? "-"}
                    </td>
                    <td className="px-2 py-2">
                      {topup.receiptSignedUrl ? (
                        <a
                          href={topup.receiptSignedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Ver comprobante
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-danger">
                      {topup.status === "rejected" ? topup.rejectionReason : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
