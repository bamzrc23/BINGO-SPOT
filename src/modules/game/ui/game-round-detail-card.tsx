import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  LINE_TYPE_LABELS,
  type GameRoundDetail,
  type GameRoundSalesSummary
} from "@/modules/game/domain";
import { GameRoundStatusBadge } from "@/modules/game/ui/game-round-status-badge";

type GameRoundDetailCardProps = {
  detail: GameRoundDetail;
  showUserInfo?: boolean;
  salesSummary?: GameRoundSalesSummary | null;
};

export function GameRoundDetailCard({
  detail,
  showUserInfo = false,
  salesSummary = null
}: GameRoundDetailCardProps) {
  const multiplierGroups = {
    x2: detail.multipliers.filter((m) => m.multiplier === 2).map((m) => m.numberValue),
    x3: detail.multipliers.filter((m) => m.multiplier === 3).map((m) => m.numberValue),
    x5: detail.multipliers.filter((m) => m.multiplier === 5).map((m) => m.numberValue)
  };
  const totalPaid = detail.lineWins.reduce((sum, line) => sum + line.prizeAmount, 0);
  const uniqueUsersPaid = new Set(detail.lineWins.map((line) => line.userId)).size;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Partida #{detail.round.id.slice(0, 8)}</CardTitle>
          <GameRoundStatusBadge status={detail.round.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          UUID: <span className="font-mono">{detail.round.id}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Programada</p>
            <p className="text-sm font-medium">{formatDateTime(detail.round.scheduledAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Activada</p>
            <p className="text-sm font-medium">
              {detail.round.activatedAt ? formatDateTime(detail.round.activatedAt) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Finalizada</p>
            <p className="text-sm font-medium">
              {detail.round.finishedAt ? formatDateTime(detail.round.finishedAt) : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Giros totales</p>
            <p className="text-sm font-medium">{detail.round.totalDrawCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lineas pagadas</p>
            <p className="text-sm font-medium">{detail.lineWins.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total premios</p>
            <p className="text-sm font-medium">{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Usuarios premiados</p>
            <p className="text-sm font-medium">{uniqueUsersPaid}</p>
          </div>
          {salesSummary ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Tablas vendidas</p>
                <p className="text-sm font-medium">{salesSummary.boardsSold}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compras registradas</p>
                <p className="text-sm font-medium">{salesSummary.purchasesCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recaudacion</p>
                <p className="text-sm font-medium">{formatCurrency(salesSummary.totalSales)}</p>
              </div>
            </>
          ) : null}
        </div>

        

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Bola de la suerte</p>
          {detail.round.luckyBallTriggered ? (
            <p className="mt-1 text-sm font-medium">
              Activa en orden {detail.round.luckyBallTriggerOrder}, +{detail.round.luckyBallExtraSpins} giros.
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium">No activada en esta partida.</p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Orden exacto de sorteo</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {detail.draws.map((draw) => (
              <div
                key={draw.id}
                className="rounded-lg border border-border bg-card p-2 text-center"
              >
                <p className="text-[10px] text-muted-foreground">#{draw.drawOrder}</p>
                <p className="text-sm font-semibold">{draw.numberValue}</p>
                {draw.isExtraSpin ? (
                  <p className="text-[10px] text-success">extra</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Ultimas lineas pagadas</p>
          {detail.lineWins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aun no hay lineas pagadas en esta partida.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Linea</th>
                    <th className="px-2 py-2 font-medium">Numeros</th>
                    <th className="px-2 py-2 font-medium">Multiplicador</th>
                    <th className="px-2 py-2 font-medium">Premio</th>
                    {showUserInfo ? <th className="px-2 py-2 font-medium">Usuario</th> : null}
                    <th className="px-2 py-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lineWins.slice(-18).map((line) => (
                    <tr key={line.id} className="border-b border-border/60">
                      <td className="px-2 py-2">{LINE_TYPE_LABELS[line.lineType]}</td>
                      <td className="px-2 py-2">{line.lineNumbers.join(", ")}</td>
                      <td className="px-2 py-2">x{line.appliedMultiplier}</td>
                      <td className="px-2 py-2 font-medium">{formatCurrency(line.prizeAmount)}</td>
                      {showUserInfo ? (
                        <td className="px-2 py-2 text-muted-foreground">{line.userId.slice(0, 8)}...</td>
                      ) : null}
                      <td className="px-2 py-2 text-muted-foreground">
                        {line.paidAt ? formatDateTime(line.paidAt) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Corridas de liquidacion</p>
          {detail.prizeRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aun no se ejecutaron liquidaciones en esta partida.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium">Premio base</th>
                    <th className="px-2 py-2 font-medium">Lineas pagadas</th>
                    <th className="px-2 py-2 font-medium">Total pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.prizeRuns.slice(0, 6).map((run) => (
                    <tr key={run.id} className="border-b border-border/60">
                      <td className="px-2 py-2 text-muted-foreground">{formatDateTime(run.createdAt)}</td>
                      <td className="px-2 py-2">{formatCurrency(run.basePrize)}</td>
                      <td className="px-2 py-2">{run.linesPaid}</td>
                      <td className="px-2 py-2 font-medium">{formatCurrency(run.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
