import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBoardPurchaseHistoryByUserId } from "@/modules/game/application/board.service";
import { getCurrentGameRoundDetail, getGameRounds } from "@/modules/game/application/round.service";
import { GameRoomLive } from "@/modules/game/ui";
import { getWalletSnapshotByUserId } from "@/modules/wallet/application/wallet.service";

export default async function GamePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  let purchases = [] as Awaited<ReturnType<typeof getBoardPurchaseHistoryByUserId>>;
  let currentRound = null as Awaited<ReturnType<typeof getCurrentGameRoundDetail>>;
  let upcomingRoundId: string | null = null;
  let upcomingRoundScheduledAt: string | null = null;
  let wallet = null as Awaited<ReturnType<typeof getWalletSnapshotByUserId>> | null;
  let gameError: string | null = null;
  let roundError: string | null = null;
  let walletError: string | null = null;

  try {
    purchases = await getBoardPurchaseHistoryByUserId(user.id, {
      purchasesLimit: 8,
      boardsLimit: 220
    });
  } catch (error) {
    gameError =
      error instanceof Error ? error.message : "No se pudo cargar tus tablas compradas.";
  }

  try {
    currentRound = await getCurrentGameRoundDetail();
  } catch (error) {
    roundError = error instanceof Error ? error.message : "No se pudo cargar la partida actual.";
  }

  try {
    const scheduledRounds = await getGameRounds({
      status: "scheduled",
      limit: 1
    });
    const nextRound = scheduledRounds[0];
    if (nextRound) {
      upcomingRoundId = nextRound.id;
      upcomingRoundScheduledAt = nextRound.scheduledAt;
    }
  } catch {
    // Si falla, el formulario se bloquea por seguridad.
  }

  try {
    wallet = await getWalletSnapshotByUserId(user.id, { limit: 8 });
  } catch (error) {
    walletError = error instanceof Error ? error.message : "No se pudo cargar el saldo.";
  }

  const purchaseBlockedByActiveRound = currentRound?.round.status === "active";
  const isPurchaseBlocked = purchaseBlockedByActiveRound || !upcomingRoundId;
  const purchaseBlockedReason = purchaseBlockedByActiveRound
    ? "La partida en curso ya inicio. Las compras se habilitan para la siguiente ronda programada."
    : !upcomingRoundId
      ? "Aun no existe una proxima partida programada para asignar tus tablas."
      : null;

  return (
    <div className="space-y-6">
      <GameRoomLive
        userId={user.id}
        initialRound={currentRound}
        initialPurchases={purchases}
        initialWallet={wallet?.wallet ?? null}
        initialRoundError={roundError}
        initialPurchasesError={gameError}
        initialWalletError={walletError}
        upcomingGameId={upcomingRoundId}
        upcomingGameScheduledAt={upcomingRoundScheduledAt}
        isPurchaseBlocked={isPurchaseBlocked}
        purchaseBlockedReason={purchaseBlockedReason}
      />
    </div>
  );
}
