import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  activateGameRoundSchema,
  createGameRoundSchema,
  finalizeGameRoundSchema,
  gameRoundsQuerySchema
} from "@/lib/validation";
import type {
  ActivateGameRoundInput,
  CreateGameRoundInput,
  FinalizeGameRoundInput,
  GameRoundDetail,
  GameRoundRow
} from "@/modules/game/domain";
import {
  activateGameRound,
  createGameRound,
  finalizeGameRound,
  getActiveGameRoundId,
  getGameRoundById,
  getGameRoundLuckyBallEvent,
  listGameRoundLineWins,
  listGameRoundDraws,
  listGameRoundMultipliers,
  listGameRoundPrizeRuns,
  listGameRounds
} from "@/modules/game/infrastructure";

function normalizeRoundError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  if (!message) {
    return fallback;
  }

  if (message.includes("ADMIN_ROLE_REQUIRED")) {
    return "Accion restringida a administradores.";
  }

  if (message.includes("ANOTHER_ACTIVE_GAME_EXISTS")) {
    return "Ya existe una partida activa. Finalizala antes de activar otra.";
  }

  if (message.includes("EXTRA_SPIN_3_MUST_BE_LOWEST")) {
    return "La probabilidad de 3 giros extra debe ser la mas baja.";
  }

  if (message.includes("GAME_ROUND_NOT_FOUND")) {
    return "La partida solicitada no existe.";
  }

  return message;
}

function assertRoundDetailConsistency(detail: GameRoundDetail) {
  const multiplierByValue = new Map<number, number>();
  detail.multipliers.forEach((item) => {
    multiplierByValue.set(item.numberValue, item.multiplier);
  });

  const x2Count = detail.multipliers.filter((item) => item.multiplier === 2).length;
  const x3Count = detail.multipliers.filter((item) => item.multiplier === 3).length;
  const x5Count = detail.multipliers.filter((item) => item.multiplier === 5).length;

  if (detail.round.status !== "scheduled") {
    if (x2Count !== 3 || x3Count !== 1 || x5Count !== 1) {
      throw new Error("La configuracion de multiplicadores de la partida es inconsistente.");
    }
  }

  const uniqueDrawnNumbers = new Set(detail.draws.map((draw) => draw.numberValue));
  if (uniqueDrawnNumbers.size !== detail.draws.length) {
    throw new Error("Se detectaron numeros repetidos en el sorteo.");
  }

  if (detail.round.status !== "scheduled") {
    if (detail.draws.length !== detail.round.totalDrawCount) {
      throw new Error("El total de giros guardado no coincide con los sorteos registrados.");
    }
  }

  if (detail.round.luckyBallTriggered) {
    if (!detail.luckyBallEvent) {
      throw new Error("La partida indica bola de la suerte pero no existe evento registrado.");
    }
  }

  const lineKeys = new Set<string>();
  const drawnNumbers = new Set(detail.draws.map((draw) => draw.numberValue));
  detail.lineWins.forEach((line) => {
    const key = `${line.boardId}:${line.lineType}`;
    if (lineKeys.has(key)) {
      throw new Error("Se detectaron lineas duplicadas pagadas para una misma tabla.");
    }

    if (line.lineNumbers.length !== 3) {
      throw new Error("Se detecto una linea con cantidad de numeros invalida.");
    }

    const uniqueLineNumbers = new Set(line.lineNumbers);
    if (uniqueLineNumbers.size !== 3) {
      throw new Error("Se detecto una linea con numeros repetidos.");
    }

    if (line.lineNumbers.some((value) => !drawnNumbers.has(value))) {
      throw new Error("Se detecto una linea pagada con numeros no sorteados.");
    }

    let expectedAdditiveMultiplier = 0;
    let expectedCompoundMultiplier = 1;
    line.lineNumbers.forEach((value) => {
      const multiplier = multiplierByValue.get(value);
      if (multiplier) {
        expectedAdditiveMultiplier += multiplier;
        expectedCompoundMultiplier *= multiplier;
      }
    });
    if (expectedAdditiveMultiplier <= 0) {
      expectedAdditiveMultiplier = 1;
      expectedCompoundMultiplier = 1;
    }
    const matchesAdditive = line.appliedMultiplier === expectedAdditiveMultiplier;
    const matchesLegacyCompound = line.appliedMultiplier === expectedCompoundMultiplier;
    if (!matchesAdditive && !matchesLegacyCompound) {
      throw new Error("Se detecto una linea pagada con multiplicador inconsistente.");
    }

    lineKeys.add(key);
  });
}

export async function createGameRoundByAdmin(input: CreateGameRoundInput): Promise<GameRoundRow> {
  const parsed = createGameRoundSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de partida invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await createGameRound(supabase, {
    scheduledAt: parsed.data.scheduledAt,
    metadata: input.metadata
  });

  if (error || !data) {
    throw new Error(normalizeRoundError(error, "No se pudo crear la partida."));
  }

  return data;
}

export async function activateGameRoundByAdmin(
  input: ActivateGameRoundInput
): Promise<GameRoundRow> {
  const parsed = activateGameRoundSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Configuracion de activacion invalida.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await activateGameRound(supabase, {
    gameRoundId: parsed.data.gameRoundId,
    luckyBallProbability: parsed.data.luckyBallProbability,
    extraSpinsP1: parsed.data.extraSpinsP1,
    extraSpinsP2: parsed.data.extraSpinsP2,
    extraSpinsP3: parsed.data.extraSpinsP3,
    metadata: input.metadata
  });

  if (error || !data) {
    throw new Error(normalizeRoundError(error, "No se pudo activar la partida."));
  }

  return data;
}

export async function finalizeGameRoundByAdmin(
  input: FinalizeGameRoundInput
): Promise<GameRoundRow> {
  const parsed = finalizeGameRoundSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de finalizacion invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await finalizeGameRound(supabase, {
    gameRoundId: parsed.data.gameRoundId,
    metadata: input.metadata
  });

  if (error || !data) {
    throw new Error(normalizeRoundError(error, "No se pudo finalizar la partida."));
  }

  return data;
}

type ListGameRoundsOptions = {
  limit?: number;
  status?: "scheduled" | "active" | "finished";
};

export async function getGameRounds(options?: ListGameRoundsOptions): Promise<GameRoundRow[]> {
  const query = gameRoundsQuerySchema.safeParse({
    limit: options?.limit ?? 10,
    status: options?.status
  });

  if (!query.success) {
    throw new Error("Parametros de consulta de partidas invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listGameRounds(supabase, {
    limit: query.data.limit,
    status: query.data.status
  });

  if (error) {
    throw new Error(normalizeRoundError(error, "No se pudo cargar el listado de partidas."));
  }

  return data;
}

export async function getGameRoundDetailById(gameRoundId: string): Promise<GameRoundDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data: round, error: roundError } = await getGameRoundById(supabase, gameRoundId);
  if (roundError) {
    throw new Error(normalizeRoundError(roundError, "No se pudo cargar la partida."));
  }

  if (!round) {
    return null;
  }

  const [
    { data: multipliers, error: multipliersError },
    { data: draws, error: drawsError },
    { data: luckyEvent, error: luckyError },
    { data: lineWins, error: lineWinsError },
    { data: prizeRuns, error: prizeRunsError }
  ] =
    await Promise.all([
      listGameRoundMultipliers(supabase, gameRoundId),
      listGameRoundDraws(supabase, gameRoundId),
      getGameRoundLuckyBallEvent(supabase, gameRoundId),
      listGameRoundLineWins(supabase, gameRoundId),
      listGameRoundPrizeRuns(supabase, gameRoundId)
    ]);

  if (multipliersError || drawsError || luckyError || lineWinsError || prizeRunsError) {
    throw new Error("No se pudo cargar detalle completo de la partida.");
  }

  const detail: GameRoundDetail = {
    round,
    multipliers,
    draws,
    luckyBallEvent: luckyEvent,
    lineWins,
    prizeRuns
  };

  assertRoundDetailConsistency(detail);
  return detail;
}

export async function getActiveGameRoundDetail(): Promise<GameRoundDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data: activeId, error } = await getActiveGameRoundId(supabase);
  if (error) {
    throw new Error(normalizeRoundError(error, "No se pudo consultar partida activa."));
  }

  if (!activeId) {
    return null;
  }

  return getGameRoundDetailById(activeId);
}

export async function getCurrentGameRoundDetail(): Promise<GameRoundDetail | null> {
  const active = await getActiveGameRoundDetail();
  if (active) {
    return active;
  }

  const rounds = await getGameRounds({ limit: 1 });
  const latestRound = rounds.at(0);
  if (!latestRound) {
    return null;
  }

  return getGameRoundDetailById(latestRound.id);
}
