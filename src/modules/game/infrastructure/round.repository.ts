import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import type {
  ActivateGameRoundInput,
  CreateGameRoundInput,
  FinalizeGameRoundInput,
  GameRoundDrawRow,
  GameRoundLineWinRow,
  GameRoundLuckyBallEventRow,
  GameRoundMultiplierRow,
  GameRoundPrizeRunRow,
  GameRoundRow
} from "@/modules/game/domain";

type AppSupabaseClient = SupabaseClient<Database>;
type GameRoundDbRow = Database["public"]["Tables"]["game_rounds"]["Row"];
type GameRoundMultiplierDbRow = Database["public"]["Tables"]["game_round_multipliers"]["Row"];
type GameRoundDrawDbRow = Database["public"]["Tables"]["game_round_draws"]["Row"];
type GameRoundLuckyBallEventDbRow = Database["public"]["Tables"]["game_round_lucky_ball_events"]["Row"];
type GameRoundLineWinDbRow = Database["public"]["Tables"]["game_round_line_wins"]["Row"];
type GameRoundPrizeRunDbRow = Database["public"]["Tables"]["game_round_prize_runs"]["Row"];

function mapGameRoundRow(row: GameRoundDbRow): GameRoundRow {
  return {
    id: row.id,
    status: row.status,
    scheduledAt: row.scheduled_at,
    activatedAt: row.activated_at,
    finishedAt: row.finished_at,
    baseDrawCount: row.base_draw_count,
    extraDrawCount: row.extra_draw_count,
    totalDrawCount: row.total_draw_count,
    luckyBallProbability: Number(row.lucky_ball_probability),
    luckyBallTriggered: row.lucky_ball_triggered,
    luckyBallTriggerOrder: row.lucky_ball_trigger_order,
    luckyBallExtraSpins: row.lucky_ball_extra_spins,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGameRoundMultiplierRow(row: GameRoundMultiplierDbRow): GameRoundMultiplierRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    numberValue: row.number_value,
    multiplier: row.multiplier as GameRoundMultiplierRow["multiplier"],
    createdAt: row.created_at
  };
}

function mapGameRoundDrawRow(row: GameRoundDrawDbRow): GameRoundDrawRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    drawOrder: row.draw_order,
    numberValue: row.number_value,
    isExtraSpin: row.is_extra_spin,
    createdAt: row.created_at
  };
}

function mapLuckyBallEventRow(row: GameRoundLuckyBallEventDbRow): GameRoundLuckyBallEventRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    triggerOrder: row.trigger_order,
    extraSpins: row.extra_spins as GameRoundLuckyBallEventRow["extraSpins"],
    randomValue: Number(row.random_value),
    createdAt: row.created_at
  };
}

function mapGameRoundLineWinRow(row: GameRoundLineWinDbRow): GameRoundLineWinRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    boardId: row.board_id,
    purchaseId: row.purchase_id,
    userId: row.user_id,
    lineType: row.line_type,
    lineNumbers: row.line_numbers ?? [],
    appliedMultiplier: row.applied_multiplier,
    basePrize: Number(row.base_prize),
    prizeAmount: Number(row.prize_amount),
    walletTransactionId: row.wallet_transaction_id,
    operationRef: row.operation_ref,
    paidAt: row.paid_at,
    createdAt: row.created_at
  };
}

function mapGameRoundPrizeRunRow(row: GameRoundPrizeRunDbRow): GameRoundPrizeRunRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    executedBy: row.executed_by,
    basePrize: Number(row.base_prize),
    linesPaid: row.lines_paid,
    totalPaid: Number(row.total_paid),
    metadata: row.metadata,
    createdAt: row.created_at
  };
}

function getRpcSingle<T>(data: T[] | T | null): T | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

export async function createGameRound(client: AppSupabaseClient, input: CreateGameRoundInput) {
  const { data, error } = await client.rpc("create_game_round", {
    p_scheduled_at: input.scheduledAt ?? null,
    p_metadata: (input.metadata ?? {}) as Json
  });

  if (error) {
    return { data: null as GameRoundRow | null, error };
  }

  const row = getRpcSingle(data);
  return { data: row ? mapGameRoundRow(row) : null, error: null };
}

export async function activateGameRound(client: AppSupabaseClient, input: ActivateGameRoundInput) {
  const { data, error } = await client.rpc("activate_game_round", {
    p_game_round_id: input.gameRoundId,
    p_lucky_ball_probability: input.luckyBallProbability ?? 0.12,
    p_extra_spins_p1: input.extraSpinsP1 ?? 0.7,
    p_extra_spins_p2: input.extraSpinsP2 ?? 0.22,
    p_extra_spins_p3: input.extraSpinsP3 ?? 0.08,
    p_metadata: (input.metadata ?? {}) as Json
  });

  if (error) {
    return { data: null as GameRoundRow | null, error };
  }

  const row = getRpcSingle(data);
  return { data: row ? mapGameRoundRow(row) : null, error: null };
}

export async function finalizeGameRound(client: AppSupabaseClient, input: FinalizeGameRoundInput) {
  const { data, error } = await client.rpc("finalize_game_round", {
    p_game_round_id: input.gameRoundId,
    p_metadata: (input.metadata ?? {}) as Json
  });

  if (error) {
    return { data: null as GameRoundRow | null, error };
  }

  const row = getRpcSingle(data);
  return { data: row ? mapGameRoundRow(row) : null, error: null };
}

export async function getActiveGameRoundId(client: AppSupabaseClient) {
  const { data, error } = await client.rpc("get_active_game_round_id");
  if (error) {
    return { data: null as string | null, error };
  }

  const readValue = (value: unknown): string | null => {
    if (typeof value === "string") {
      return value;
    }

    if (value && typeof value === "object" && "get_active_game_round_id" in value) {
      const field = (value as { get_active_game_round_id?: unknown }).get_active_game_round_id;
      return typeof field === "string" ? field : null;
    }

    return null;
  };

  if (Array.isArray(data)) {
    return { data: readValue(data[0]), error: null };
  }

  return { data: readValue(data), error: null };
}

export async function getGameRoundById(client: AppSupabaseClient, gameRoundId: string) {
  const { data, error } = await client
    .from("game_rounds")
    .select("*")
    .eq("id", gameRoundId)
    .maybeSingle();

  if (error) {
    return { data: null as GameRoundRow | null, error };
  }

  return { data: data ? mapGameRoundRow(data) : null, error: null };
}

export async function listGameRounds(
  client: AppSupabaseClient,
  options: {
    limit: number;
    status?: GameRoundDbRow["status"];
  }
) {
  let query = client.from("game_rounds").select("*");

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.status === "scheduled") {
    query = query
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(options.limit);
  if (error) {
    return { data: [] as GameRoundRow[], error };
  }

  return { data: (data ?? []).map(mapGameRoundRow), error: null };
}

export async function listGameRoundMultipliers(client: AppSupabaseClient, gameRoundId: string) {
  const { data, error } = await client
    .from("game_round_multipliers")
    .select("*")
    .eq("game_round_id", gameRoundId)
    .order("multiplier", { ascending: false })
    .order("number_value", { ascending: true });

  if (error) {
    return { data: [] as GameRoundMultiplierRow[], error };
  }

  return { data: (data ?? []).map(mapGameRoundMultiplierRow), error: null };
}

export async function listGameRoundDraws(client: AppSupabaseClient, gameRoundId: string) {
  const { data, error } = await client
    .from("game_round_draws")
    .select("*")
    .eq("game_round_id", gameRoundId)
    .order("draw_order", { ascending: true });

  if (error) {
    return { data: [] as GameRoundDrawRow[], error };
  }

  return { data: (data ?? []).map(mapGameRoundDrawRow), error: null };
}

export async function getGameRoundLuckyBallEvent(client: AppSupabaseClient, gameRoundId: string) {
  const { data, error } = await client
    .from("game_round_lucky_ball_events")
    .select("*")
    .eq("game_round_id", gameRoundId)
    .maybeSingle();

  if (error) {
    return { data: null as GameRoundLuckyBallEventRow | null, error };
  }

  return { data: data ? mapLuckyBallEventRow(data) : null, error: null };
}

export async function listGameRoundLineWins(client: AppSupabaseClient, gameRoundId: string) {
  const { data, error } = await client
    .from("game_round_line_wins")
    .select("*")
    .eq("game_round_id", gameRoundId)
    .order("created_at", { ascending: true });

  if (error) {
    return { data: [] as GameRoundLineWinRow[], error };
  }

  return { data: (data ?? []).map(mapGameRoundLineWinRow), error: null };
}

export async function listGameRoundPrizeRuns(client: AppSupabaseClient, gameRoundId: string) {
  const { data, error } = await client
    .from("game_round_prize_runs")
    .select("*")
    .eq("game_round_id", gameRoundId)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [] as GameRoundPrizeRunRow[], error };
  }

  return { data: (data ?? []).map(mapGameRoundPrizeRunRow), error: null };
}

export async function settleGameRoundLinePrizes(
  client: AppSupabaseClient,
  input: {
    gameRoundId: string;
    basePrize: number;
    metadata?: Record<string, unknown>;
  }
) {
  const { data, error } = await client.rpc("settle_game_round_line_prizes", {
    p_game_round_id: input.gameRoundId,
    p_base_prize: input.basePrize,
    p_metadata: (input.metadata ?? {}) as Json
  });

  if (error) {
    return {
      data: [] as {
        lineWinId: string;
        userId: string;
        boardId: string;
        lineType: GameRoundLineWinRow["lineType"];
        lineNumbers: number[];
        appliedMultiplier: number;
        basePrize: number;
        prizeAmount: number;
        walletTransactionId: string;
      }[],
      error
    };
  }

  const rows = (data ?? []).map((row) => ({
    lineWinId: row.line_win_id,
    userId: row.user_id,
    boardId: row.board_id,
    lineType: row.line_type,
    lineNumbers: row.line_numbers ?? [],
    appliedMultiplier: row.applied_multiplier,
    basePrize: Number(row.base_prize),
    prizeAmount: Number(row.prize_amount),
    walletTransactionId: row.wallet_transaction_id
  }));

  return { data: rows, error: null };
}
