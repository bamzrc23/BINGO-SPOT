import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { AdminDashboardMetrics } from "@/modules/admin/domain";

type AdminDashboardMetricsProps = {
  metrics: AdminDashboardMetrics;
};

export function AdminDashboardMetricsCards({ metrics }: AdminDashboardMetricsProps) {
  const breakdown = metrics.boardSalesBreakdown;
  const hasBreakdown = breakdown.length > 0;

  const getStakeLabel = (stakeTier: string) => {
    if (stakeTier === "basic") return "Basic";
    if (stakeTier === "plus") return "Plus";
    if (stakeTier === "pro") return "Pro";
    if (stakeTier === "max") return "Max";
    return "Sin nivel";
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-2xl font-semibold">{metrics.usersTotal}</p>
          <p className="text-muted-foreground">Activos: {metrics.usersActive}</p>
          <p className="text-muted-foreground">Suspendidos: {metrics.usersSuspended}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operaciones pendientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-2xl font-semibold">{metrics.topupsPending + metrics.withdrawalsPending}</p>
          <p className="text-muted-foreground">Recargas: {metrics.topupsPending}</p>
          <p className="text-muted-foreground">Retiros: {metrics.withdrawalsPending}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tablas vendidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-2xl font-semibold">{metrics.boardsSoldTotal}</p>
          <p className="text-muted-foreground">Tablas vendidas</p>
          <p className="text-muted-foreground">Partida activa: {metrics.activeRoundId ? "Si" : "No"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas (USD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-2xl font-semibold">{formatCurrency(metrics.boardsRevenueTotal)}</p>
          <p className="text-muted-foreground">Total cobrado por compra de tablas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Premios pagados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-2xl font-semibold text-success">{formatCurrency(metrics.prizesPaidTotal)}</p>
          <p className="text-muted-foreground">Acumulado historico</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado neto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p
            className={`text-2xl font-semibold ${
              metrics.netGamingResultTotal >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatCurrency(metrics.netGamingResultTotal)}
          </p>
          <p className="text-muted-foreground">Ventas de tablas - premios pagados</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 xl:col-span-4">
        <CardHeader>
          <CardTitle className="text-base">Desglose de ventas por precio y nivel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {hasBreakdown ? (
            <div className="space-y-2">
              {breakdown.map((item) => (
                <div
                  key={`${item.stakeTier}-${item.unitPrice}`}
                  className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-4"
                >
                  <p>
                    <span className="text-muted-foreground">Nivel:</span> {getStakeLabel(item.stakeTier)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Precio:</span> {formatCurrency(item.unitPrice)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tablas:</span> {item.boardsSold}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Venta:</span> {formatCurrency(item.salesTotal)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Aun no hay ventas registradas.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
