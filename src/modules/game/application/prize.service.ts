import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { settleGameRoundPrizesSchema } from "@/lib/validation";
import type { SettledLinePrizeRow, SettleGameRoundPrizesInput } from "@/modules/game/domain";
import { settleGameRoundLinePrizes } from "@/modules/game/infrastructure";

function normalizePrizeError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  if (!message) {
    return fallback;
  }

  if (message.includes("ADMIN_ROLE_REQUIRED")) {
    return "Accion restringida a administradores.";
  }

  if (message.includes("INVALID_GAME_ROUND_STATUS_FOR_PRIZES")) {
    return "Solo puedes liquidar premios en partidas activas o finalizadas.";
  }

  if (message.includes("ROUND_DRAWS_NOT_FOUND")) {
    return "La partida no tiene sorteos registrados.";
  }

  if (message.includes("BASE_PRIZE_MUST_BE_POSITIVE")) {
    return "El premio base debe ser mayor a cero.";
  }

  return message;
}

export async function settleLinePrizesByAdmin(
  input: SettleGameRoundPrizesInput
): Promise<SettledLinePrizeRow[]> {
  const parsed = settleGameRoundPrizesSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de liquidacion invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await settleGameRoundLinePrizes(supabase, {
    gameRoundId: parsed.data.gameRoundId,
    basePrize: parsed.data.basePrize,
    metadata: input.metadata
  });

  if (error) {
    throw new Error(normalizePrizeError(error, "No se pudieron liquidar los premios."));
  }

  return data;
}
