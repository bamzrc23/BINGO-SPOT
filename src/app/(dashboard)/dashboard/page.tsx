import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { getUserDashboardMetrics } from "@/modules/user/application";
import type { UserDashboardMetrics } from "@/modules/user/domain";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

const EMPTY_METRICS: UserDashboardMetrics = {
  balance: 0,
  activeBoards: 0,
  totalPrizesWon: 0,
  playedRounds: 0
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  let metrics = EMPTY_METRICS;
  let dashboardError: string | null = null;

  try {
    metrics = await getUserDashboardMetrics(user.id);
  } catch (error) {
    dashboardError =
      error instanceof Error ? error.message : "No se pudo cargar el INICIO.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-black">INICIO</h1>
        <Badge variant="success">En vivo</Badge>
      </div>

      {dashboardError ? (
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardContent className="p-4 text-sm font-semibold text-danger">{dashboardError}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardHeader>
            <CardTitle className="text-base">Saldo disponible</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(metrics.balance)}
          </CardContent>
        </Card>
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardHeader>
            <CardTitle className="text-base">Tablas activas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics.activeBoards}</CardContent>
        </Card>
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardHeader>
            <CardTitle className="text-base">Premios ganados</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(metrics.totalPrizesWon)}
          </CardContent>
        </Card>
        <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
          <CardHeader>
            <CardTitle className="text-base">Partidas jugadas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics.playedRounds}</CardContent>
        </Card>
      </div>
    </div>
  );
}
