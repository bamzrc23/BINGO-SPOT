import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserDashboardMetrics } from "@/modules/user/domain";
import { ensureWalletForUser } from "@/modules/wallet/infrastructure";

const EMPTY_USER_DASHBOARD_METRICS: UserDashboardMetrics = {
  balance: 0,
  activeBoards: 0,
  totalPrizesWon: 0,
  playedRounds: 0
};

function normalizeDashboardError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  return message.length > 0 ? message : fallback;
}

export async function getUserDashboardMetrics(userId: string): Promise<UserDashboardMetrics> {
  const supabase = await createServerSupabaseClient();

  const [
    walletResult,
    activeRoundIdResult,
    prizeTransactionsResult,
    completedPurchasesResult
  ] = await Promise.all([
    ensureWalletForUser(supabase, userId),
    supabase.rpc("get_active_game_round_id"),
    supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("movement_type", "prize")
      .eq("direction", "credit"),
    supabase
      .from("board_purchases")
      .select("game_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("game_id", "is", null)
  ]);

  if (walletResult.error || !walletResult.data) {
    throw new Error(
      normalizeDashboardError(walletResult.error, "No se pudo cargar el saldo de la billetera.")
    );
  }

  if (activeRoundIdResult.error) {
    throw new Error(
      normalizeDashboardError(
        activeRoundIdResult.error,
        "No se pudo consultar la partida activa para el dashboard."
      )
    );
  }

  if (prizeTransactionsResult.error) {
    throw new Error(
      normalizeDashboardError(
        prizeTransactionsResult.error,
        "No se pudo calcular el total de premios ganados."
      )
    );
  }

  if (completedPurchasesResult.error) {
    throw new Error(
      normalizeDashboardError(
        completedPurchasesResult.error,
        "No se pudo calcular el total de partidas jugadas."
      )
    );
  }

  const purchasedRoundIds = Array.from(
    new Set(
      (completedPurchasesResult.data ?? [])
        .map((row) => row.game_id)
        .filter((gameId): gameId is string => Boolean(gameId))
    )
  );

  let playedRounds = 0;
  if (purchasedRoundIds.length > 0) {
    const { data: rounds, error: roundsError } = await supabase
      .from("game_rounds")
      .select("id, status")
      .in("id", purchasedRoundIds);

    if (roundsError) {
      throw new Error(
        normalizeDashboardError(
          roundsError,
          "No se pudo consultar el estado de las partidas jugadas."
        )
      );
    }

    playedRounds = (rounds ?? []).filter((round) => round.status !== "scheduled").length;
  }

  const activeRoundId = activeRoundIdResult.data;
  let targetRoundId: string | null = activeRoundId ?? null;

  if (!targetRoundId) {
    const { data: scheduledRound, error: scheduledError } = await supabase
      .from("game_rounds")
      .select("id")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (scheduledError) {
      throw new Error(
        normalizeDashboardError(
          scheduledError,
          "No se pudo consultar la proxima partida para contar tablas activas."
        )
      );
    }

    targetRoundId = scheduledRound?.id ?? null;
  }

  let activeBoards = 0;
  if (targetRoundId) {
    const { count, error: activeBoardsError } = await supabase
      .from("bingo_boards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("game_id", targetRoundId);

    if (activeBoardsError) {
      throw new Error(
        normalizeDashboardError(
          activeBoardsError,
          "No se pudo calcular la cantidad de tablas activas."
        )
      );
    }

    activeBoards = count ?? 0;
  }

  const totalPrizesWon = (prizeTransactionsResult.data ?? []).reduce((acc, row) => {
    return acc + Number(row.amount);
  }, 0);

  return {
    ...EMPTY_USER_DASHBOARD_METRICS,
    balance: Number(walletResult.data.balance),
    activeBoards,
    totalPrizesWon,
    playedRounds
  };
}
