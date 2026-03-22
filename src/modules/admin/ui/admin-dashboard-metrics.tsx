import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { AdminDashboardMetrics } from "@/modules/admin/domain";

type AdminDashboardMetricsProps = {
  metrics: AdminDashboardMetrics;
};

export function AdminDashboardMetricsCards({ metrics }: AdminDashboardMetricsProps) {
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
          <CardTitle className="text-base">Ventas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-2xl font-semibold">{metrics.boardsSoldTotal}</p>
          <p className="text-muted-foreground">Tablas vendidas</p>
          <p className="text-muted-foreground">Partida activa: {metrics.activeRoundId ? "Si" : "No"}</p>
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
    </div>
  );
}
