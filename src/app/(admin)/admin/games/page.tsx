import {
  getActiveGameRoundDetail,
  getGameRoundDetailById,
  getGameRounds
} from "@/modules/game/application/round.service";
import { getGameRoundSalesSummary } from "@/modules/game/application/board.service";
import {
  GameRoundAdminControls,
  GameRoundDetailCard
} from "@/modules/game/ui";
import type { GameRoundSalesSummary } from "@/modules/game/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default async function AdminGamesPage() {
  let rounds = [] as Awaited<ReturnType<typeof getGameRounds>>;
  let roundsError: string | null = null;

  try {
    rounds = await getGameRounds({ limit: 8 });
  } catch (error) {
    roundsError =
      error instanceof Error ? error.message : "No se pudieron cargar las partidas.";
  }

  let activeRoundId: string | null = null;
  try {
    const activeRound = await getActiveGameRoundDetail();
    activeRoundId = activeRound?.round.id ?? null;
  } catch {
    activeRoundId = null;
  }

  const roundDetails = await Promise.all(
    rounds.map(async (round) => {
      try {
        return await getGameRoundDetailById(round.id);
      } catch {
        return null;
      }
    })
  );

  let salesSummaryByGame = new Map<string, GameRoundSalesSummary>();
  try {
    salesSummaryByGame = await getGameRoundSalesSummary(rounds.map((round) => round.id));
  } catch {
    salesSummaryByGame = new Map();
  }

  return (
    <div className="space-y-6">
      <GameRoundAdminControls activeRoundId={activeRoundId} />

      {roundsError ? (
        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-danger">{roundsError}</CardContent>
        </Card>
      ) : roundDetails.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Partidas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No hay partidas registradas todavia.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {roundDetails.map((detail) => {
            if (!detail) {
              return null;
            }

            return (
              <GameRoundDetailCard
                key={detail.round.id}
                detail={detail}
                showUserInfo
                salesSummary={salesSummaryByGame.get(detail.round.id) ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
