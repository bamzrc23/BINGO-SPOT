import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { getAdminDashboardMetricsData } from "@/modules/admin/application/admin.service";
import { AdminDashboardMetricsCards } from "@/modules/admin/ui";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function AdminHomePage() {
  let metrics = null as Awaited<ReturnType<typeof getAdminDashboardMetricsData>> | null;
  let metricsError: string | null = null;

  try {
    metrics = await getAdminDashboardMetricsData();
  } catch (error) {
    metricsError = error instanceof Error ? error.message : "No se pudieron cargar metricas.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Panel administrativo</h1>
        <Badge variant="danger">Restringido</Badge>
      </div>

      {metricsError ? (
        <Card>
          <CardContent className="p-4 text-sm text-danger">{metricsError}</CardContent>
        </Card>
      ) : metrics ? (
        <AdminDashboardMetricsCards metrics={metrics} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Atajos operativos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link href={ROUTES.adminUsers} className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
            Gestion de usuarios y billeteras
          </Link>
          <Link href={ROUTES.adminTopups} className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
            Bandeja de recargas
          </Link>
          <Link href={ROUTES.adminWithdrawals} className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
            Bandeja de retiros
          </Link>
          <Link href={ROUTES.adminGames} className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
            Control de partidas y premios
          </Link>
          <Link href={ROUTES.adminSettings} className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
            Parametros del juego
          </Link>
          <Link href={ROUTES.adminAudit} className="rounded-xl border border-border p-3 text-sm hover:bg-muted">
            Auditoria de operaciones
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
