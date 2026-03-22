"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import {
  activateGameRoundByAdmin,
  createGameRoundByAdmin,
  finalizeGameRoundByAdmin
} from "@/modules/game/application/round.service";
import {
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

export async function createGameRoundAction(
  _previousState: GameRoundFormState = INITIAL_GAME_ROUND_FORM_STATE,
  formData: FormData
): Promise<GameRoundFormState> {
  try {
    const scheduledAt = parseStringField(formData, "scheduledAt");

    const round = await createGameRoundByAdmin({
      scheduledAt: scheduledAt || undefined
    });

    revalidatePath(ROUTES.adminGames);
    revalidatePath(ROUTES.game);

    return buildSuccessState(
      `Partida programada con UUID ${round.id}. Usa este UUID completo para activar/finalizar.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la partida.";
    return buildErrorState(message);
  }
}

export async function activateGameRoundAction(
  _previousState: GameRoundFormState = INITIAL_GAME_ROUND_FORM_STATE,
  formData: FormData
): Promise<GameRoundFormState> {
  try {
    const gameRoundId = parseStringField(formData, "gameRoundId");
    const luckyBallProbability = parseStringField(formData, "luckyBallProbability");
    const extraSpinsP1 = parseStringField(formData, "extraSpinsP1");
    const extraSpinsP2 = parseStringField(formData, "extraSpinsP2");
    const extraSpinsP3 = parseStringField(formData, "extraSpinsP3");

    const round = await activateGameRoundByAdmin({
      gameRoundId,
      luckyBallProbability: luckyBallProbability ? Number(luckyBallProbability) : undefined,
      extraSpinsP1: extraSpinsP1 ? Number(extraSpinsP1) : undefined,
      extraSpinsP2: extraSpinsP2 ? Number(extraSpinsP2) : undefined,
      extraSpinsP3: extraSpinsP3 ? Number(extraSpinsP3) : undefined
    });

    revalidatePath(ROUTES.adminGames);
    revalidatePath(ROUTES.game);

    const luckyText = round.luckyBallTriggered
      ? `Bola de la suerte en orden ${round.luckyBallTriggerOrder} (+${round.luckyBallExtraSpins} giros).`
      : "Sin bola de la suerte.";

    return buildSuccessState(
      `Partida activada. Total giros: ${round.totalDrawCount}. ${luckyText}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo activar la partida.";
    return buildErrorState(message);
  }
}

export async function finalizeGameRoundAction(
  _previousState: GameRoundFormState = INITIAL_GAME_ROUND_FORM_STATE,
  formData: FormData
): Promise<GameRoundFormState> {
  try {
    const gameRoundId = parseStringField(formData, "gameRoundId");

    const round = await finalizeGameRoundByAdmin({
      gameRoundId
    });

    revalidatePath(ROUTES.adminGames);
    revalidatePath(ROUTES.game);

    return buildSuccessState(`Partida ${round.id.slice(0, 8)} finalizada.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo finalizar la partida.";
    return buildErrorState(message);
  }
}
