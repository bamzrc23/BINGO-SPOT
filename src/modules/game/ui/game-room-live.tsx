"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import {
  GAME_DEFAULT_BASE_LINE_PRIZE,
  GAME_ROOM_AUTOMATION_TICK_MS,
  GAME_ROOM_DRAW_INTERVAL_SECONDS,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P1,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P2,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P3,
  GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY,
  GAME_ROOM_POLL_FALLBACK_MS,
  GAME_ROOM_PRESTART_ANIMATION_SECONDS,
  GAME_ROOM_ROUND_COOLDOWN_SECONDS,
  GAME_ROOM_WIN_FEEDBACK_DURATION_MS,
  LINE_TYPE_LABELS,
  type BingoBoardRow,
  type BingoGrid,
  type BoardPurchaseRow,
  type BoardPurchaseWithBoards,
  type GameRoomPhase,
  type GameRoundDetail,
  type GameRoundDrawRow,
  type GameRoundLineWinRow,
  type GameRoundLuckyBallEventRow,
  type GameRoundMultiplierRow,
  type GameRoundRow
} from "@/modules/game/domain";
import { BoardPurchaseForm } from "@/modules/game/ui/board-purchase-form";
import { LiveBingoBoardGrid } from "@/modules/game/ui/live-bingo-board-grid";
import type { WalletRow } from "@/modules/wallet/domain";
import type { Database } from "@/types/database";
import type { BingoLineType } from "@/types/domain";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

const ALL_LINE_TYPES: BingoLineType[] = ["row_1", "row_2", "row_3", "col_1", "col_2", "col_3"];

type GameRoomLiveProps = {
  userId: string;
  initialRound: GameRoundDetail | null;
  initialPurchases: BoardPurchaseWithBoards[];
  initialWallet: WalletRow | null;
  initialRoundError?: string | null;
  initialPurchasesError?: string | null;
  initialWalletError?: string | null;
  upcomingGameId?: string | null;
  upcomingGameScheduledAt?: string | null;
  isPurchaseBlocked?: boolean;
  purchaseBlockedReason?: string | null;
};

type GameRoundDbRow = Database["public"]["Tables"]["game_rounds"]["Row"];
type GameRoundMultiplierDbRow = Database["public"]["Tables"]["game_round_multipliers"]["Row"];
type GameRoundDrawDbRow = Database["public"]["Tables"]["game_round_draws"]["Row"];
type GameRoundLuckyEventDbRow = Database["public"]["Tables"]["game_round_lucky_ball_events"]["Row"];
type GameRoundLineWinDbRow = Database["public"]["Tables"]["game_round_line_wins"]["Row"];
type BoardPurchaseDbRow = Database["public"]["Tables"]["board_purchases"]["Row"];
type BingoBoardDbRow = Database["public"]["Tables"]["bingo_boards"]["Row"];
type WalletDbRow = Database["public"]["Tables"]["wallets"]["Row"];

type BoardView = {
  purchase: BoardPurchaseWithBoards;
  board: BingoBoardRow;
  displayIndex: number;
  completedLines: BingoLineType[];
  paidLines: BingoLineType[];
  totalPrizePaid: number;
};

type MissingLineCandidate = {
  key: string;
  boardId: string;
  boardIndex: number;
  lineType: BingoLineType;
  missingNumbers: number[];
  appliedMultiplier: number;
  isPaid: boolean;
};

function mapRoundRow(row: GameRoundDbRow): GameRoundRow {
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

function mapMultiplierRow(row: GameRoundMultiplierDbRow): GameRoundMultiplierRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    numberValue: row.number_value,
    multiplier: row.multiplier as GameRoundMultiplierRow["multiplier"],
    createdAt: row.created_at
  };
}

function mapDrawRow(row: GameRoundDrawDbRow): GameRoundDrawRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    drawOrder: row.draw_order,
    numberValue: row.number_value,
    isExtraSpin: row.is_extra_spin,
    createdAt: row.created_at
  };
}

function mapLuckyEventRow(row: GameRoundLuckyEventDbRow): GameRoundLuckyBallEventRow {
  return {
    id: row.id,
    gameRoundId: row.game_round_id,
    triggerOrder: row.trigger_order,
    extraSpins: row.extra_spins as GameRoundLuckyBallEventRow["extraSpins"],
    randomValue: Number(row.random_value),
    createdAt: row.created_at
  };
}

function mapLineWinRow(row: GameRoundLineWinDbRow): GameRoundLineWinRow {
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

function mapPurchaseRow(row: BoardPurchaseDbRow): BoardPurchaseRow {
  return {
    id: row.id,
    userId: row.user_id,
    gameId: row.game_id,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    status: row.status,
    walletTransactionId: row.wallet_transaction_id,
    operationRef: row.operation_ref,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBoardRow(row: BingoBoardDbRow): BingoBoardRow {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    userId: row.user_id,
    gameId: row.game_id,
    boardIndex: row.board_index,
    boardFingerprint: row.board_fingerprint,
    grid: row.grid as BingoGrid,
    createdAt: row.created_at
  };
}

function mapWalletRow(row: WalletDbRow): WalletRow {
  return {
    id: row.id,
    userId: row.user_id,
    balance: Number(row.balance),
    lockedBalance: Number(row.locked_balance),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getLineNumbers(grid: BingoGrid, lineType: BingoLineType): number[] {
  if (lineType === "row_1") return [...grid[0]];
  if (lineType === "row_2") return [...grid[1]];
  if (lineType === "row_3") return [...grid[2]];
  if (lineType === "col_1") return [grid[0][0], grid[1][0], grid[2][0]];
  if (lineType === "col_2") return [grid[0][1], grid[1][1], grid[2][1]];
  return [grid[0][2], grid[1][2], grid[2][2]];
}

function getCompletedLineTypes(grid: BingoGrid, markedNumbers: Set<number>): BingoLineType[] {
  return ALL_LINE_TYPES.filter((lineType) =>
    getLineNumbers(grid, lineType).every((numberValue) => markedNumbers.has(numberValue))
  );
}

function getPhase(detail: GameRoundDetail | null, isLoading: boolean): GameRoomPhase {
  if (isLoading) return "loading";
  if (!detail) return "waiting";
  if (detail.round.status === "active") return "active";
  if (detail.round.status === "finished") return "finished";
  return "waiting";
}

function getRevealedDrawCount(detail: GameRoundDetail | null, nowMs: number): number {
  if (!detail || detail.draws.length === 0) {
    return 0;
  }

  const isRoundPlaybackState =
    detail.round.status === "active" || detail.round.status === "finished";

  if (!isRoundPlaybackState) {
    return 0;
  }

  if (!detail.round.activatedAt) {
    return detail.round.status === "finished" ? detail.draws.length : 0;
  }

  const activatedAtMs = new Date(detail.round.activatedAt).getTime();
  const elapsedMs = Math.max(0, nowMs - activatedAtMs);
  const elapsedAfterIntroMs = elapsedMs - GAME_ROOM_PRESTART_ANIMATION_SECONDS * 1000;
  if (elapsedAfterIntroMs < 0) {
    return 0;
  }

  const elapsedSteps = Math.floor(elapsedAfterIntroMs / (GAME_ROOM_DRAW_INTERVAL_SECONDS * 1000));
  const count = Math.max(1, elapsedSteps + 1);
  return Math.min(detail.draws.length, count);
}

function toCountdownSeconds(targetAt: string | null | undefined, nowMs: number): number {
  if (!targetAt) {
    return 0;
  }

  const diffMs = new Date(targetAt).getTime() - nowMs;
  return Math.max(0, Math.ceil(diffMs / 1000));
}

function dedupeLineWins(lineWins: GameRoundLineWinRow[]): GameRoundLineWinRow[] {
  const map = new Map<string, GameRoundLineWinRow>();
  lineWins.forEach((line) => {
    map.set(line.id, line);
  });

  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function dedupeLineWinsDesc(lineWins: GameRoundLineWinRow[]): GameRoundLineWinRow[] {
  const map = new Map<string, GameRoundLineWinRow>();
  lineWins.forEach((line) => {
    map.set(line.id, line);
  });

  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function GameRoomLive({
  userId,
  initialRound,
  initialPurchases,
  initialWallet,
  initialRoundError = null,
  initialPurchasesError = null,
  initialWalletError = null,
  upcomingGameId = null,
  upcomingGameScheduledAt = null,
  isPurchaseBlocked = false,
  purchaseBlockedReason = null
}: GameRoomLiveProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [roundDetail, setRoundDetail] = useState<GameRoundDetail | null>(initialRound);
  const [purchases, setPurchases] = useState<BoardPurchaseWithBoards[]>(initialPurchases);
  const [wallet, setWallet] = useState<WalletRow | null>(initialWallet);
  const [, setUserPrizeLines] = useState<GameRoundLineWinRow[]>(
    dedupeLineWinsDesc(initialRound?.lineWins ?? [])
  );

  const [roundError, setRoundError] = useState<string | null>(initialRoundError);
  const [purchasesError, setPurchasesError] = useState<string | null>(initialPurchasesError);
  const [walletError, setWalletError] = useState<string | null>(initialWalletError);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setIsRealtimeConnected] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lineFeedbackMessage, setLineFeedbackMessage] = useState<string | null>(null);
  const [prizeFeedbackMessage, setPrizeFeedbackMessage] = useState<string | null>(null);
  const [highlightedBoardId, setHighlightedBoardId] = useState<string | null>(null);
  const [rollingDrawNumber, setRollingDrawNumber] = useState<number | null>(null);
  const [isRollingLocked, setIsRollingLocked] = useState(false);
  const [winCelebration, setWinCelebration] = useState<{
    roundId: string;
    amount: number;
  } | null>(null);
  const [liveUpcomingGameId, setLiveUpcomingGameId] = useState<string | null>(upcomingGameId);
  const [liveUpcomingGameScheduledAt, setLiveUpcomingGameScheduledAt] = useState<string | null>(
    upcomingGameScheduledAt
  );

  const knownCompletedLineKeysRef = useRef<Set<string>>(new Set());
  const completionInitializedRef = useRef(false);
  const knownPaidLineIdsRef = useRef<Set<string>>(
    new Set(initialRound?.lineWins.map((line) => line.id) ?? [])
  );
  const currentRoundIdRef = useRef<string | null>(initialRound?.round.id ?? null);
  const lastSpokenDrawIdRef = useRef<string | null>(null);
  const announcedFinishedRoundIdRef = useRef<string | null>(null);
  const announcedPrestartRoundIdRef = useRef<string | null>(null);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
      return;
    }

    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const spanishVoice = synthesis
      .getVoices()
      .find((voice) => voice.lang?.toLowerCase().startsWith("es"));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
      utterance.lang = spanishVoice.lang;
    } else {
      utterance.lang = "es-EC";
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    synthesis.cancel();
    synthesis.speak(utterance);
  }, []);

  const fetchCurrentRoundDetail = useCallback(async (): Promise<GameRoundDetail | null> => {
    const { data: activeRows, error: activeError } = await supabase
      .from("game_rounds")
      .select("*")
      .eq("status", "active")
      .order("activated_at", { ascending: false })
      .limit(1);

    if (activeError) {
      throw new Error("No se pudo consultar la partida activa.");
    }

    let selectedRound = activeRows?.[0] ?? null;

    if (!selectedRound) {
      const { data: finishedRows, error: finishedError } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "finished")
        .order("finished_at", { ascending: false })
        .limit(1);

      if (finishedError) {
        throw new Error("No se pudo consultar la ultima partida finalizada.");
      }

      selectedRound = finishedRows?.[0] ?? null;
    }

    if (!selectedRound) {
      const { data: scheduledRows, error: scheduledError } = await supabase
        .from("game_rounds")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1);

      if (scheduledError) {
        throw new Error("No se pudo consultar la proxima partida programada.");
      }

      selectedRound = scheduledRows?.[0] ?? null;
    }

    if (!selectedRound) {
      return null;
    }

    const gameRoundId = selectedRound.id;
    const [
      { data: multipliers, error: multipliersError },
      { data: draws, error: drawsError },
      { data: luckyEvent, error: luckyError },
      { data: lineWins, error: lineWinsError }
    ] = await Promise.all([
      supabase
        .from("game_round_multipliers")
        .select("*")
        .eq("game_round_id", gameRoundId)
        .order("multiplier", { ascending: false })
        .order("number_value", { ascending: true }),
      supabase
        .from("game_round_draws")
        .select("*")
        .eq("game_round_id", gameRoundId)
        .order("draw_order", { ascending: true }),
      supabase
        .from("game_round_lucky_ball_events")
        .select("*")
        .eq("game_round_id", gameRoundId)
        .maybeSingle(),
      supabase
        .from("game_round_line_wins")
        .select("*")
        .eq("game_round_id", gameRoundId)
        .order("created_at", { ascending: true })
    ]);

    if (multipliersError || drawsError || luckyError || lineWinsError) {
      throw new Error("No se pudo cargar el detalle realtime de la partida.");
    }

    return {
      round: mapRoundRow(selectedRound),
      multipliers: (multipliers ?? []).map(mapMultiplierRow),
      draws: (draws ?? []).map(mapDrawRow),
      luckyBallEvent: luckyEvent ? mapLuckyEventRow(luckyEvent) : null,
      lineWins: dedupeLineWins((lineWins ?? []).map(mapLineWinRow)),
      prizeRuns: []
    };
  }, [supabase]);

  const fetchPurchasesWithBoards = useCallback(async (): Promise<BoardPurchaseWithBoards[]> => {
    const { data: purchaseRows, error: purchaseError } = await supabase
      .from("board_purchases")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(16);

    if (purchaseError) {
      throw new Error("No se pudieron actualizar tus compras de tablas.");
    }

    const purchasesMapped = (purchaseRows ?? []).map(mapPurchaseRow);
    const purchaseIds = purchasesMapped.map((purchase) => purchase.id);

    if (purchaseIds.length === 0) {
      return [];
    }

    const { data: boardRows, error: boardError } = await supabase
      .from("bingo_boards")
      .select("*")
      .in("purchase_id", purchaseIds)
      .order("purchase_id", { ascending: false })
      .order("board_index", { ascending: true })
      .limit(500);

    if (boardError) {
      throw new Error("No se pudieron actualizar tus tablas.");
    }

    const boardsMapped = (boardRows ?? []).map(mapBoardRow);
    const boardsByPurchase = new Map<string, BingoBoardRow[]>();
    boardsMapped.forEach((board) => {
      const current = boardsByPurchase.get(board.purchaseId) ?? [];
      current.push(board);
      boardsByPurchase.set(board.purchaseId, current);
    });

    return purchasesMapped.map((purchase) => ({
      ...purchase,
      boards: boardsByPurchase.get(purchase.id) ?? []
    }));
  }, [supabase, userId]);

  const fetchWallet = useCallback(async (): Promise<WalletRow | null> => {
    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error("No se pudo actualizar tu saldo.");
    }

    return data ? mapWalletRow(data) : null;
  }, [supabase, userId]);

  const fetchUserPrizeLines = useCallback(async (): Promise<GameRoundLineWinRow[]> => {
    const { data, error } = await supabase
      .from("game_round_line_wins")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      throw new Error("No se pudo actualizar tu historial de premios.");
    }

    return dedupeLineWinsDesc((data ?? []).map(mapLineWinRow));
  }, [supabase, userId]);

  const refreshUpcomingPurchaseTarget = useCallback(async () => {
    const { data, error } = await supabase
      .from("game_rounds")
      .select("id, scheduled_at, created_at")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error("No se pudo consultar la proxima partida programada.");
    }

    setLiveUpcomingGameId(data?.id ?? null);
    setLiveUpcomingGameScheduledAt(data?.scheduled_at ?? null);
  }, [supabase]);

  const runAutomationTick = useCallback(async () => {
    const { error } = await supabase.rpc("run_game_round_automation", {
      p_draw_interval_seconds: GAME_ROOM_DRAW_INTERVAL_SECONDS,
      p_prestart_animation_seconds: GAME_ROOM_PRESTART_ANIMATION_SECONDS,
      p_round_cooldown_seconds: GAME_ROOM_ROUND_COOLDOWN_SECONDS,
      p_base_prize: GAME_DEFAULT_BASE_LINE_PRIZE,
      p_lucky_ball_probability: GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY,
      p_extra_spins_p1: GAME_ROUND_DEFAULT_EXTRA_SPINS_P1,
      p_extra_spins_p2: GAME_ROUND_DEFAULT_EXTRA_SPINS_P2,
      p_extra_spins_p3: GAME_ROUND_DEFAULT_EXTRA_SPINS_P3
    });

    if (error) {
      throw new Error("No se pudo ejecutar el ciclo automatico de partidas.");
    }
  }, [supabase]);

  const refreshRound = useCallback(async () => {
    try {
      const detail = await fetchCurrentRoundDetail();
      setRoundDetail(detail);
      setRoundError(null);
    } catch (error) {
      setRoundError(
        error instanceof Error ? error.message : "No se pudo sincronizar la partida."
      );
    }
  }, [fetchCurrentRoundDetail]);

  const refreshPurchases = useCallback(async () => {
    try {
      const data = await fetchPurchasesWithBoards();
      setPurchases(data);
      setPurchasesError(null);
    } catch (error) {
      setPurchasesError(
        error instanceof Error ? error.message : "No se pudo sincronizar tus tablas."
      );
    }
  }, [fetchPurchasesWithBoards]);

  const refreshWallet = useCallback(async () => {
    try {
      const nextWallet = await fetchWallet();
      setWallet(nextWallet);
      setWalletError(null);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "No se pudo sincronizar tu saldo.");
    }
  }, [fetchWallet]);

  const refreshPrizeLines = useCallback(async () => {
    try {
      const lines = await fetchUserPrizeLines();
      setUserPrizeLines(lines);
    } catch {
      // Si falla, la UI se mantiene con el ultimo estado local.
    }
  }, [fetchUserPrizeLines]);

  const refreshAll = useCallback(
    async (showRefreshing: boolean) => {
      if (showRefreshing) {
        setIsRefreshing(true);
      }

      await Promise.all([
        refreshRound(),
        refreshPurchases(),
        refreshWallet(),
        refreshPrizeLines(),
        refreshUpcomingPurchaseTarget()
      ]);

      if (showRefreshing) {
        setIsRefreshing(false);
      }
    },
    [refreshPrizeLines, refreshPurchases, refreshRound, refreshUpcomingPurchaseTarget, refreshWallet]
  );

  const handlePurchaseCompleted = useCallback(() => {
    const runSync = async () => {
      await Promise.all([refreshPurchases(), refreshWallet(), refreshUpcomingPurchaseTarget()]);
    };

    void (async () => {
      await runSync();
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      await runSync();
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await runSync();
    })();
  }, [refreshPurchases, refreshUpcomingPurchaseTarget, refreshWallet]);

  useEffect(() => {
    let cancelled = false;

    void refreshAll(false).finally(() => {
      if (!cancelled) {
        setIsBootstrapping(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  useEffect(() => {
    const channel = supabase.channel(`game-room:${userId}`);

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rounds" },
        () => {
          void refreshRound();
          void refreshUpcomingPurchaseTarget();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_round_line_wins",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as GameRoundLineWinDbRow;
          const nextLine = mapLineWinRow(row);

          setRoundDetail((previous) => {
            if (!previous || previous.round.id !== nextLine.gameRoundId) {
              return previous;
            }

            return {
              ...previous,
              lineWins: dedupeLineWins([...previous.lineWins, nextLine])
            };
          });

          setUserPrizeLines((previous) => dedupeLineWinsDesc([nextLine, ...previous]));
          setWinCelebration((previous) => {
            if (previous && previous.roundId === nextLine.gameRoundId) {
              return {
                roundId: previous.roundId,
                amount: Math.round((previous.amount + nextLine.prizeAmount) * 100) / 100
              };
            }

            return {
              roundId: nextLine.gameRoundId,
              amount: nextLine.prizeAmount
            };
          });

          void refreshWallet();
          void refreshPrizeLines();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new) {
            setWallet(mapWalletRow(payload.new as WalletDbRow));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wallet_transactions",
          filter: `user_id=eq.${userId}`
        },
        () => {
          void refreshWallet();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "board_purchases",
          filter: `user_id=eq.${userId}`
        },
        () => {
          void refreshPurchases();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bingo_boards",
          filter: `user_id=eq.${userId}`
        },
        () => {
          void refreshPurchases();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsRealtimeConnected(true);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    refreshPrizeLines,
    refreshPurchases,
    refreshRound,
    refreshUpcomingPurchaseTarget,
    refreshWallet,
    supabase,
    userId
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        await runAutomationTick();
      } catch {
        if (!cancelled) {
          // El fallback por polling/realtime mantiene la sala operativa.
        }
      }
    };

    void tick();
    const automationId = window.setInterval(() => {
      void tick();
    }, GAME_ROOM_AUTOMATION_TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(automationId);
    };
  }, [runAutomationTick]);

  useEffect(() => {
    const pollId = window.setInterval(() => {
      void refreshAll(false);
    }, GAME_ROOM_POLL_FALLBACK_MS);

    return () => {
      window.clearInterval(pollId);
    };
  }, [refreshAll]);

  useEffect(() => {
    const currentRoundId = roundDetail?.round.id ?? null;
    if (currentRoundIdRef.current === currentRoundId) {
      return;
    }

    currentRoundIdRef.current = currentRoundId;
    knownPaidLineIdsRef.current = new Set(roundDetail?.lineWins.map((line) => line.id) ?? []);
    knownCompletedLineKeysRef.current = new Set();
    completionInitializedRef.current = false;
    setLineFeedbackMessage(null);
    setPrizeFeedbackMessage(null);
    setHighlightedBoardId(null);
    setRollingDrawNumber(null);
    setIsRollingLocked(false);
    lastSpokenDrawIdRef.current = null;
  }, [roundDetail?.lineWins, roundDetail?.round.id]);

  useEffect(() => {
    if (!roundDetail) {
      return;
    }

    const knownIds = knownPaidLineIdsRef.current;
    const newPaidLines = roundDetail.lineWins.filter((line) => !knownIds.has(line.id));

    if (newPaidLines.length > 0) {
      const newest = newPaidLines.at(-1);
      if (!newest) {
        return;
      }

      setPrizeFeedbackMessage(
        `Premio acreditado: ${LINE_TYPE_LABELS[newest.lineType]} por ${formatCurrency(
          newest.prizeAmount
        )}.`
      );
      setHighlightedBoardId(newest.boardId);
      newPaidLines.forEach((line) => knownIds.add(line.id));
    }
  }, [roundDetail]);

  useEffect(() => {
    if (!lineFeedbackMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLineFeedbackMessage(null);
    }, GAME_ROOM_WIN_FEEDBACK_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lineFeedbackMessage]);

  useEffect(() => {
    if (!prizeFeedbackMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPrizeFeedbackMessage(null);
    }, GAME_ROOM_WIN_FEEDBACK_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [prizeFeedbackMessage]);

  useEffect(() => {
    if (!highlightedBoardId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedBoardId(null);
    }, GAME_ROOM_WIN_FEEDBACK_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightedBoardId]);

  useEffect(() => {
    if (!winCelebration) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWinCelebration(null);
    }, GAME_ROOM_WIN_FEEDBACK_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [winCelebration]);

  const phase = getPhase(roundDetail, isBootstrapping);
  const revealedDrawCount = getRevealedDrawCount(roundDetail, nowMs);
  const prestartRevealAt =
    roundDetail?.round.activatedAt && roundDetail.round.status === "active"
      ? new Date(
          new Date(roundDetail.round.activatedAt).getTime() +
            GAME_ROOM_PRESTART_ANIMATION_SECONDS * 1000
        ).toISOString()
      : null;
  const prestartRemainingSeconds = toCountdownSeconds(prestartRevealAt, nowMs);
  const isPrestartAnimation = Boolean(
    phase === "active" && roundDetail && revealedDrawCount === 0 && prestartRemainingSeconds > 0
  );
  const prestartMultiplierRevealCount = useMemo(() => {
    if (!isPrestartAnimation || !roundDetail?.round.activatedAt) {
      return 5;
    }

    const activatedAtMs = new Date(roundDetail.round.activatedAt).getTime();
    const elapsedMs = Math.max(0, nowMs - activatedAtMs);
    const revealDurationMs = 5000;
    const revealStepMs = revealDurationMs / 5;
    const revealCount = Math.floor(elapsedMs / revealStepMs);
    return Math.max(0, Math.min(5, revealCount));
  }, [isPrestartAnimation, nowMs, roundDetail?.round.activatedAt]);
  const cleanupEndsAt =
    roundDetail?.round.finishedAt && roundDetail.round.status === "finished"
      ? new Date(
          new Date(roundDetail.round.finishedAt).getTime() +
            GAME_ROOM_ROUND_COOLDOWN_SECONDS * 1000
        ).toISOString()
      : null;
  const cleanupRemainingSeconds = toCountdownSeconds(cleanupEndsAt, nowMs);
  const isCleanupPhase = Boolean(
    roundDetail?.round.status === "finished" && cleanupRemainingSeconds > 0
  );
  const scheduledStartRemainingSeconds =
    roundDetail?.round.status === "scheduled"
      ? toCountdownSeconds(roundDetail.round.scheduledAt, nowMs)
      : 0;
  const revealedDraws = useMemo(
    () => roundDetail?.draws.slice(0, revealedDrawCount) ?? [],
    [revealedDrawCount, roundDetail]
  );
  const markedNumbers = useMemo(
    () => new Set(revealedDraws.map((draw) => draw.numberValue)),
    [revealedDraws]
  );

  const groupedMultipliers = useMemo(() => {
    return {
      x2:
        roundDetail?.multipliers
          .filter((item) => item.multiplier === 2)
          .map((item) => item.numberValue) ?? [],
      x3:
        roundDetail?.multipliers
          .filter((item) => item.multiplier === 3)
          .map((item) => item.numberValue) ?? [],
      x5:
        roundDetail?.multipliers
          .filter((item) => item.multiplier === 5)
          .map((item) => item.numberValue) ?? []
    };
  }, [roundDetail?.multipliers]);

  const multiplierSlots = useMemo(() => {
    return [...(roundDetail?.multipliers ?? [])].sort((a, b) => {
      if (a.multiplier !== b.multiplier) {
        return a.multiplier - b.multiplier;
      }
      return a.numberValue - b.numberValue;
    });
  }, [roundDetail?.multipliers]);

  const visibleRoundMultipliers = useMemo(() => {
    if (!isPrestartAnimation) {
      return roundDetail?.multipliers ?? [];
    }

    return multiplierSlots.slice(0, prestartMultiplierRevealCount);
  }, [isPrestartAnimation, multiplierSlots, prestartMultiplierRevealCount, roundDetail?.multipliers]);

  const visibleMultipliersByNumber = useMemo(() => {
    const map = new Map<number, number>();
    visibleRoundMultipliers.forEach((item) => {
      map.set(item.numberValue, item.multiplier);
    });
    return map;
  }, [visibleRoundMultipliers]);

  const displayedBoardsRoundId = useMemo(() => {
    const currentRoundId = roundDetail?.round.id ?? null;
    const roundStatus = roundDetail?.round.status;
    const hasCurrentRoundPurchases = Boolean(
      currentRoundId && purchases.some((purchase) => purchase.gameId === currentRoundId)
    );
    const hasUpcomingRoundPurchases = Boolean(
      liveUpcomingGameId && purchases.some((purchase) => purchase.gameId === liveUpcomingGameId)
    );

    if (roundStatus === "active") {
      if (hasCurrentRoundPurchases) return currentRoundId;
      if (hasUpcomingRoundPurchases) return liveUpcomingGameId;
    }

    if (hasUpcomingRoundPurchases) return liveUpcomingGameId;
    if (hasCurrentRoundPurchases) return currentRoundId;
    return liveUpcomingGameId ?? currentRoundId ?? null;
  }, [liveUpcomingGameId, purchases, roundDetail?.round.id, roundDetail?.round.status]);

  const purchasesOfDisplayedRound = useMemo(() => {
    if (!displayedBoardsRoundId) {
      return [] as BoardPurchaseWithBoards[];
    }

    return purchases.filter((purchase) => purchase.gameId === displayedBoardsRoundId);
  }, [displayedBoardsRoundId, purchases]);

  const isDisplayingCurrentRoundBoards = Boolean(
    displayedBoardsRoundId && displayedBoardsRoundId === roundDetail?.round.id
  );
  const boardMarkedNumbers = useMemo(
    () => (isDisplayingCurrentRoundBoards ? markedNumbers : new Set<number>()),
    [isDisplayingCurrentRoundBoards, markedNumbers]
  );
  const boardMultipliersByNumber = useMemo(
    () => (isDisplayingCurrentRoundBoards ? visibleMultipliersByNumber : new Map<number, number>()),
    [isDisplayingCurrentRoundBoards, visibleMultipliersByNumber]
  );

  const lineWinsByBoard = useMemo(() => {
    const map = new Map<string, GameRoundLineWinRow[]>();
    (roundDetail?.lineWins ?? []).forEach((line) => {
      const current = map.get(line.boardId) ?? [];
      current.push(line);
      map.set(line.boardId, current);
    });
    return map;
  }, [roundDetail?.lineWins]);

  const boardViews = useMemo<BoardView[]>(() => {
    const unsortedViews: Array<Omit<BoardView, "displayIndex">> = [];

    purchasesOfDisplayedRound.forEach((purchase) => {
      purchase.boards.forEach((board) => {
        const paidLines = isDisplayingCurrentRoundBoards
          ? (lineWinsByBoard.get(board.id) ?? []).map((line) => line.lineType)
          : [];
        const completedLines = isDisplayingCurrentRoundBoards
          ? getCompletedLineTypes(board.grid, boardMarkedNumbers)
          : [];
        const totalPrizePaid = isDisplayingCurrentRoundBoards
          ? (lineWinsByBoard.get(board.id) ?? []).reduce((sum, line) => sum + line.prizeAmount, 0)
          : 0;

        unsortedViews.push({
          purchase,
          board,
          completedLines,
          paidLines,
          totalPrizePaid
        });
      });
    });

    unsortedViews.sort((a, b) => {
      if (a.purchase.createdAt !== b.purchase.createdAt) {
        return a.purchase.createdAt.localeCompare(b.purchase.createdAt);
      }
      if (a.board.boardIndex !== b.board.boardIndex) {
        return a.board.boardIndex - b.board.boardIndex;
      }
      return a.board.createdAt.localeCompare(b.board.createdAt);
    });

    return unsortedViews.map((view, index) => ({
      ...view,
      displayIndex: index + 1
    }));
  }, [
    boardMarkedNumbers,
    isDisplayingCurrentRoundBoards,
    lineWinsByBoard,
    purchasesOfDisplayedRound
  ]);

  useEffect(() => {
    const currentCompleted = new Set<string>();

    boardViews.forEach((view) => {
      view.completedLines.forEach((lineType) => {
        currentCompleted.add(`${view.board.id}:${lineType}`);
      });
    });

    if (!completionInitializedRef.current) {
      completionInitializedRef.current = true;
      knownCompletedLineKeysRef.current = currentCompleted;
      return;
    }

    const known = knownCompletedLineKeysRef.current;
    const newLineKeys = Array.from(currentCompleted).filter((key) => !known.has(key));

    if (newLineKeys.length > 0) {
      const firstKey = newLineKeys.at(0);
      if (!firstKey) {
        return;
      }

      const [boardId, lineTypeRaw] = firstKey.split(":");
      if (!boardId || !lineTypeRaw) {
        return;
      }

      const lineType = lineTypeRaw as BingoLineType;
      const matchedBoard = boardViews.find((view) => view.board.id === boardId);

      setLineFeedbackMessage(
        `Linea completada en tabla #${matchedBoard?.displayIndex ?? "?"}: ${
          LINE_TYPE_LABELS[lineType]
        }.`
      );
      setHighlightedBoardId(boardId);
    }

    knownCompletedLineKeysRef.current = currentCompleted;
  }, [boardViews]);

  const luckyBallReached = Boolean(
    roundDetail?.round.luckyBallTriggered &&
      roundDetail.round.luckyBallTriggerOrder &&
      revealedDrawCount >= roundDetail.round.luckyBallTriggerOrder
  );

  const recentDraws = useMemo(
    () => [...revealedDraws].reverse().slice(0, 30),
    [revealedDraws]
  );
  const currentDraw = recentDraws[0] ?? null;
  const isAllRoundNumbersRevealed = Boolean(
    roundDetail && roundDetail.draws.length > 0 && revealedDrawCount >= roundDetail.draws.length
  );
  const isPlaybackActive = Boolean(
    roundDetail &&
      ((phase === "active" && roundDetail.round.status === "active") ||
        (phase === "finished" && !isAllRoundNumbersRevealed))
  );

  useEffect(() => {
    if (!currentDraw) {
      return;
    }

    setRollingDrawNumber(currentDraw.numberValue);
    setIsRollingLocked(true);

    const timer = window.setTimeout(() => {
      setIsRollingLocked(false);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentDraw?.id, currentDraw?.numberValue]);

  useEffect(() => {
    if (!isPlaybackActive || isCleanupPhase || isPrestartAnimation || isAllRoundNumbersRevealed) {
      if (!currentDraw) {
        setRollingDrawNumber(null);
      }
      return;
    }

    if (isRollingLocked) {
      return;
    }

    const spin = () => {
      setRollingDrawNumber(Math.floor(Math.random() * 30) + 1);
    };

    spin();
    const interval = window.setInterval(spin, 85);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    isPlaybackActive,
    isCleanupPhase,
    isPrestartAnimation,
    isAllRoundNumbersRevealed,
    isRollingLocked,
    currentDraw?.id,
    roundDetail?.round.id
  ]);

  const displayBallNumber = useMemo(() => {
    if (isPlaybackActive) {
      if (isRollingLocked && currentDraw) {
        return currentDraw.numberValue;
      }

      if (typeof rollingDrawNumber === "number") {
        return rollingDrawNumber;
      }
    }

    if (currentDraw) {
      return currentDraw.numberValue;
    }

    return 0;
  }, [isPlaybackActive, isRollingLocked, currentDraw, rollingDrawNumber]);

  const luckyMarkerOrder = roundDetail?.round.luckyBallTriggered
    ? roundDetail.round.luckyBallTriggerOrder
    : null;
  const isLuckyMarkerCurrentDraw = Boolean(
    currentDraw && luckyMarkerOrder && currentDraw.drawOrder === luckyMarkerOrder
  );
  const isCurrentBallSettled = Boolean(currentDraw) && (!isPlaybackActive || isRollingLocked);
  const displayBallLabel = String(displayBallNumber).padStart(2, "0");
  const calledNumbersCount = revealedDraws.length;
  const calledNumbersTarget =
    roundDetail?.round.totalDrawCount ?? roundDetail?.round.baseDrawCount ?? 9;

  useEffect(() => {
    if (!currentDraw || !isPlaybackActive || !isCurrentBallSettled) {
      return;
    }

    if (lastSpokenDrawIdRef.current === currentDraw.id) {
      return;
    }

    lastSpokenDrawIdRef.current = currentDraw.id;
    const isLuckyEventDraw =
      Boolean(luckyMarkerOrder) && currentDraw.drawOrder === luckyMarkerOrder;

    if (isLuckyEventDraw && (roundDetail?.round.luckyBallExtraSpins ?? 0) > 0) {
      const extraSpins = roundDetail?.round.luckyBallExtraSpins ?? 0;
      const spinsWord = extraSpins === 1 ? "giro" : "giros";
      speakText(`Numero ${currentDraw.numberValue}. Bola de la suerte. ${extraSpins} ${spinsWord} extra.`);
      return;
    }

    speakText(`Numero ${currentDraw.numberValue}.`);
  }, [
    currentDraw,
    isPlaybackActive,
    isCurrentBallSettled,
    luckyMarkerOrder,
    roundDetail?.round.luckyBallExtraSpins,
    speakText
  ]);

  useEffect(() => {
    if (!roundDetail || roundDetail.round.status !== "finished") {
      return;
    }

    if (announcedFinishedRoundIdRef.current === roundDetail.round.id) {
      return;
    }

    announcedFinishedRoundIdRef.current = roundDetail.round.id;
    speakText(
      `Partida terminada. Iniciamos en ${GAME_ROOM_ROUND_COOLDOWN_SECONDS} segundos la siguiente. Compra tus tablas ahora.`
    );
  }, [roundDetail, speakText]);

  useEffect(() => {
    if (!roundDetail || !isPrestartAnimation || roundDetail.round.status !== "active") {
      return;
    }

    if (announcedPrestartRoundIdRef.current === roundDetail.round.id) {
      return;
    }

    announcedPrestartRoundIdRef.current = roundDetail.round.id;
    speakText("Iniciamos una nueva partida. Revelando multiplicadores.");
  }, [isPrestartAnimation, roundDetail, speakText]);

  const missingLineCards = useMemo<MissingLineCandidate[]>(() => {
    const cards: MissingLineCandidate[] = [];

    boardViews.forEach((view) => {
      ALL_LINE_TYPES.forEach((lineType) => {
        const lineNumbers = getLineNumbers(view.board.grid, lineType);
        const missingNumbers = lineNumbers.filter((numberValue) => !boardMarkedNumbers.has(numberValue));
        let appliedMultiplier = 0;
        lineNumbers.forEach((numberValue) => {
          const multiplier = boardMultipliersByNumber.get(numberValue);
          if (multiplier) {
            appliedMultiplier += multiplier;
          }
        });
        if (appliedMultiplier <= 0) {
          appliedMultiplier = 1;
        }
        const isPaid = view.paidLines.includes(lineType);

        cards.push({
          key: `${view.board.id}:${lineType}`,
          boardId: view.board.id,
          boardIndex: view.displayIndex,
          lineType,
          missingNumbers,
          appliedMultiplier,
          isPaid
        });
      });
    });

    cards.sort((a, b) => {
      if (a.isPaid !== b.isPaid) {
        return a.isPaid ? -1 : 1;
      }

      if (a.missingNumbers.length !== b.missingNumbers.length) {
        return a.missingNumbers.length - b.missingNumbers.length;
      }

      if (a.boardIndex !== b.boardIndex) {
        return a.boardIndex - b.boardIndex;
      }

      return a.lineType.localeCompare(b.lineType);
    });

    return cards.slice(0, 9);
  }, [boardMarkedNumbers, boardMultipliersByNumber, boardViews]);

  const missingNumbersSummary = useMemo(() => {
    const unique = new Set<number>();
    missingLineCards
      .filter((item) => !item.isPaid && item.missingNumbers.length === 1)
      .forEach((item) => {
        item.missingNumbers.forEach((value) => unique.add(value));
      });

    return Array.from(unique).sort((a, b) => a - b).slice(0, 12);
  }, [missingLineCards]);

  const hasActiveRound = roundDetail?.round.status === "active";
  const isPurchaseWindowClosed = Boolean(
    liveUpcomingGameScheduledAt && new Date(liveUpcomingGameScheduledAt).getTime() <= nowMs
  );
  const effectivePurchaseBlocked = hasActiveRound || !liveUpcomingGameId || isPurchaseWindowClosed;
  const effectivePurchaseBlockedReason = hasActiveRound
    ? "Partida en curso, espera la siguiente ronda."
    : !liveUpcomingGameId
      ? "Aun no existe una proxima partida programada para asignar tus tablas."
      : isPurchaseWindowClosed
        ? "La ventana de compra para esta ronda ya cerro. Espera la siguiente programacion."
        : purchaseBlockedReason;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden text-[15px]">
      {lineFeedbackMessage || prizeFeedbackMessage ? (
        <div className="fixed inset-x-3 top-20 z-50 sm:hidden">
          <div className="rounded-lg border-2 border-black bg-emerald-100 px-3 py-2 shadow-soft">
            {lineFeedbackMessage ? (
              <p className="text-xs font-black text-emerald-800">{lineFeedbackMessage}</p>
            ) : null}
            {prizeFeedbackMessage ? (
              <p className="text-xs font-black text-emerald-800">{prizeFeedbackMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {winCelebration ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-xs border-success bg-success/10 text-center shadow-soft sm:max-w-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-success sm:text-3xl">Ganaste!</CardTitle>
              <p className="text-xs text-success/90 sm:text-sm">
                Partida #{winCelebration.roundId.slice(0, 8)}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-success/90 sm:text-sm">
                Premio total acreditado automaticamente
              </p>
              <p className="text-3xl font-black text-success sm:text-4xl">
                {formatCurrency(winCelebration.amount)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="overflow-hidden rounded-[24px] border-4 border-black bg-neutral-100 text-black">
        <CardHeader className="bg-neutral-100 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-black uppercase">Sala de Bingo</CardTitle>
              <span className="rounded-md border-2 border-black bg-white px-2 py-0.5 text-[11px] font-bold uppercase">
                Sala {roundDetail ? `#${roundDetail.round.id.slice(0, 8)}` : "--"}
              </span>
            </div>
            <div className="rounded-lg border-2 border-black bg-white px-3 py-1 text-right">
              <p className="text-[10px] font-semibold uppercase text-black/60">Saldo</p>
              <p className="text-base font-black">{wallet ? formatCurrency(wallet.balance) : "Sin datos"}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isBootstrapping ? (
        <Card className="rounded-[24px] border-4 border-black bg-neutral-100 text-black">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-black/70">Sincronizando sala de bingo...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid w-full min-w-0 gap-4 rounded-[28px] border-4 border-black bg-neutral-200 p-3 sm:p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <div className="space-y-4">
            <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
              <CardHeader>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border-2 border-black bg-white p-3">
                  <p className="text-center text-sm font-black uppercase tracking-wide">
                    Multiplicador
                  </p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const item = multiplierSlots[index];
                      const isRevealed = index < prestartMultiplierRevealCount;

                      return (
                        <div key={`multiplier-slot-${index}`} className="space-y-1 text-center">
                          <div
                            className={cn(
                              "mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-black text-sm font-black transition-all sm:h-14 sm:w-14",
                              item
                                ? isRevealed
                                  ? "bg-white text-black"
                                  : "bg-black text-white"
                                : "border-dashed bg-neutral-200 text-black/60"
                            )}
                          >
                            {item ? (isRevealed ? item.numberValue : "?") : "--"}
                          </div>
                          <p className="text-sm font-black">
                            {item ? (isRevealed ? `x${item.multiplier}` : "x?") : "-"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-black/70">
                    {prestartMultiplierRevealCount < 5
                      ? `Revelando multiplicadores ${prestartMultiplierRevealCount}/5`
                      : isPrestartAnimation
                        ? `Multiplicadores listos. Iniciando bolillero en ${prestartRemainingSeconds}s.`
                        : `x2: ${groupedMultipliers.x2.join(", ") || "-"} · x3: ${
                            groupedMultipliers.x3.join(", ") || "-"
                          } · x5: ${groupedMultipliers.x5.join(", ") || "-"}`}
                  </p>

                </div>

                <div className="grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="rounded-xl border-2 border-black bg-white p-3 text-center">
                    <p className="text-sm font-black uppercase tracking-wide">
                      Bolillero
                    </p>
                    <div
                      className={cn(
                        "relative mx-auto mt-2 flex h-36 w-36 items-center justify-center rounded-full border-4 border-black bg-white transition-colors sm:h-40 sm:w-40",
                        isCurrentBallSettled ? "border-emerald-700 bg-emerald-200" : null
                      )}
                    >
                      <span
                        className={cn(
                          "text-6xl font-black text-black sm:text-7xl",
                          isCurrentBallSettled ? "text-emerald-800" : null,
                          phase === "active" && !isRollingLocked ? "animate-pulse" : null
                        )}
                      >
                        {displayBallLabel}
                      </span>
                      {isLuckyMarkerCurrentDraw && isCurrentBallSettled ? (
                        <span className="absolute right-2 top-2 rounded-full border-2 border-black bg-yellow-300 px-1.5 text-xs font-black leading-5 text-black">
                          S
                        </span>
                      ) : null}
                    </div>
                    {currentDraw?.isExtraSpin ? (
                      <p className="mt-2 text-xs font-black text-emerald-700">Giro extra</p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border-2 border-black bg-white p-3">
                    <p className="text-sm font-black uppercase tracking-wide">
                      Numeros cantados {calledNumbersCount}/{calledNumbersTarget}
                    </p>
                    {recentDraws.length > 0 ? (
                      <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                        {recentDraws.map((draw) => {
                          const isLuckyMarker =
                            Boolean(luckyMarkerOrder) && draw.drawOrder === luckyMarkerOrder;

                          return (
                            <div
                              key={draw.id}
                              className={cn(
                                "relative min-w-11 rounded-lg border-2 border-black px-2.5 py-1 text-center text-sm font-black",
                                isLuckyMarker
                                  ? "bg-yellow-200 text-black"
                                  : draw.isExtraSpin
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-white text-black"
                              )}
                            >
                              {draw.numberValue}
                              {isLuckyMarker ? (
                                <span className="absolute -right-1 -top-1 rounded-full border border-black bg-yellow-300 px-1 text-[10px] font-black leading-4 text-black">
                                  S
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm font-semibold text-black/70">
                        {phase === "waiting"
                          ? scheduledStartRemainingSeconds > 0
                            ? `La partida inicia en ${scheduledStartRemainingSeconds}s.`
                            : "Esperando programacion de partida."
                          : "Aun no hay numeros revelados."}
                      </p>
                    )}
                    {isPrestartAnimation ? (
                      <p className="mt-2 text-xs font-black text-black">
                        Sorteando bolitas con multiplicador. Inicio en {prestartRemainingSeconds}s.
                      </p>
                    ) : null}
                    {isCleanupPhase ? (
                      <p className="mt-2 text-xs font-semibold text-black/70">
                        Limpiando sala para la siguiente ronda en {cleanupRemainingSeconds}s.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-xl border-2 border-black bg-white p-3",
                    roundDetail?.round.luckyBallTriggered && luckyBallReached
                      ? "bg-emerald-100"
                      : null
                  )}
                >
                  <p className="text-center text-sm font-black uppercase tracking-wide">
                    Bola de la suerte
                  </p>

                  {!roundDetail ? (
                    <p className="mt-2 text-base font-semibold text-black/70">Sin partida activa.</p>
                  ) : !roundDetail.round.luckyBallTriggered ? (
                    <p className="mt-2 text-base font-semibold text-black/70">
                      Esta partida no activo bola de la suerte.
                    </p>
                  ) : luckyBallReached ? (
                    <p className="mt-2 text-base font-black text-emerald-700">
                      Activada en giro #{roundDetail.round.luckyBallTriggerOrder}: +
                      {roundDetail.round.luckyBallExtraSpins} giro(s) extra.
                    </p>
                  ) : (
                    <p className="mt-2 text-base font-semibold text-black/70">
                      Programada para el giro #{roundDetail.round.luckyBallTriggerOrder}.
                    </p>
                  )}
                </div>

                <BoardPurchaseForm
                  upcomingGameId={liveUpcomingGameId}
                  upcomingGameScheduledAt={liveUpcomingGameScheduledAt}
                  isPurchaseBlocked={effectivePurchaseBlocked}
                  blockedReason={effectivePurchaseBlockedReason}
                  onPurchaseCompleted={handlePurchaseCompleted}
                  variant="embedded"
                />
              </CardContent>
            </Card>

            {purchasesError ? (
              <Card>
                <CardContent className="p-4 text-sm text-danger">{purchasesError}</CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="rounded-[22px] border-4 border-black bg-neutral-100 text-black">
              <CardHeader>
              </CardHeader>
              <CardContent>
                {(lineFeedbackMessage || prizeFeedbackMessage) && (
                  <div className="mb-3 rounded-lg border-2 border-black bg-emerald-100 px-3 py-2">
                    {lineFeedbackMessage ? (
                      <p className="text-sm font-black text-emerald-800">{lineFeedbackMessage}</p>
                    ) : null}
                    {prizeFeedbackMessage ? (
                      <p className="text-sm font-black text-emerald-800">{prizeFeedbackMessage}</p>
                    ) : null}
                  </div>
                )}
                <p className="mb-3 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-semibold text-black/80">
                  Numeros que te faltan:{" "}
                  {boardViews.length === 0
                    ? "Compra tablas para mostrar faltantes."
                    : missingNumbersSummary.length > 0
                      ? missingNumbersSummary.join(", ")
                      : "Aun no estas a un numero de completar linea."}
                </p>
                {displayedBoardsRoundId ? (
                  <p className="mb-3 text-xs font-semibold text-black/70">
                    {isDisplayingCurrentRoundBoards
                      ? `Tablas de la partida en juego #${displayedBoardsRoundId.slice(0, 8)}`
                      : `Tablas compradas para la siguiente partida #${displayedBoardsRoundId.slice(0, 8)}`}
                  </p>
                ) : null}
                {isCleanupPhase ? (
                  <p className="mb-3 text-sm font-semibold text-black/70">
                    Limpiando tablero de la ronda finalizada. La siguiente partida iniciara en{" "}
                    {cleanupRemainingSeconds}s.
                  </p>
                ) : null}
                {boardViews.length > 0 ? (
                  <div className="max-h-[560px] overflow-y-auto overflow-x-hidden pr-1">
                    <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 lg:grid-cols-3">
                      {boardViews.map((view) => (
                        <div
                          key={view.board.id}
                          className={cn(
                            "min-w-0 space-y-2 rounded-xl border-2 border-black bg-white p-3.5 transition-all",
                            highlightedBoardId === view.board.id
                              ? "border-success shadow-soft ring-2 ring-success/40"
                              : null
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-black">Tabla #{view.displayIndex}</p>
                              <p className="break-all text-xs font-semibold text-black/60">
                                #{view.purchase.id.slice(0, 8)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-md border-2 px-2 py-1 text-xs font-black",
                                view.totalPrizePaid > 0
                                  ? "border-emerald-800 bg-emerald-200 text-emerald-900"
                                  : "border-black/30 bg-neutral-200 text-black/60"
                              )}
                            >
                              {view.totalPrizePaid > 0
                                ? `Ganado ${formatCurrency(view.totalPrizePaid)}`
                                : "Ganado $0.00"}
                            </span>
                          </div>

                          <LiveBingoBoardGrid
                            grid={view.board.grid}
                            markedNumbers={boardMarkedNumbers}
                            multiplierByNumber={boardMultipliersByNumber}
                            completedLines={view.completedLines}
                            paidLines={view.paidLines}
                            compact
                            className="bg-neutral-100"
                          />

                          <div className="flex flex-wrap gap-1">
                            {view.completedLines.length === 0 ? (
                              <Badge variant="default">Sin lineas</Badge>
                            ) : (
                              view.completedLines.map((lineType) => (
                                <Badge
                                  key={`${view.board.id}:${lineType}`}
                                  variant={view.paidLines.includes(lineType) ? "success" : "default"}
                                >
                                  {LINE_TYPE_LABELS[lineType]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aun no tienes tablas compradas para mostrar en sala.
                  </p>
                )}
              </CardContent>
            </Card>

            {(roundError || walletError) && (
              <Card>
                <CardContent className="space-y-1 p-4 text-sm text-danger">
                  {roundError ? <p>{roundError}</p> : null}
                  {walletError ? <p>{walletError}</p> : null}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {roundDetail ? (
        <p className="text-xs text-muted-foreground">
          Ultima actualizacion de sala: {formatDateTime(roundDetail.round.updatedAt)}
          {isRefreshing ? " · sincronizando..." : null}
        </p>
      ) : null}
    </div>
  );
}
