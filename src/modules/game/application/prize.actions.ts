"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import { settleLinePrizesByAdmin } from "@/modules/game/application/prize.service";
import {
  GAME_DEFAULT_BASE_LINE_PRIZE,
  INITIAL_GAME_ROUND_FORM_STATE,
  type GameRoundFormState
} from "@/modules/game/domain";

function buildErrorState(message: string, fieldErrors?: Record<string, string[] | undefined>) {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies GameRoundFormState;
}

function buildSuccessState(message: string) {
  return {
    status: "success",
    message
  } satisfies GameRoundFormState;
}

function parseStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function settleGameRoundPrizesAction(
  _previousState: GameRoundFormState = INITIAL_GAME_ROUND_FORM_STATE,
  formData: FormData
): Promise<GameRoundFormState> {
  try {
    const gameRoundId = parseStringField(formData, "gameRoundId");
    const basePrizeRaw = parseStringField(formData, "basePrize");
    const basePrize = basePrizeRaw ? Number(basePrizeRaw) : GAME_DEFAULT_BASE_LINE_PRIZE;

    const settled = await settleLinePrizesByAdmin({
      gameRoundId,
      basePrize
    });

    revalidatePath(ROUTES.adminGames);
    revalidatePath(ROUTES.game);
    revalidatePath(ROUTES.wallet);
    revalidatePath(ROUTES.history);

    if (settled.length === 0) {
      return buildSuccessState(
        "No hay lineas nuevas para pagar. La funcion es idempotente y evita doble acreditacion."
      );
    }

    const total = settled.reduce((sum, row) => sum + row.prizeAmount, 0);

    return buildSuccessState(
      `Liquidacion completada: ${settled.length} linea(s) pagadas por $${total.toFixed(2)}.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron liquidar premios.";
    return buildErrorState(message);
  }
}
