import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bingoGridSchema, boardHistoryQuerySchema, purchaseBoardsSchema } from "@/lib/validation";
import type {
  BingoBoardRow,
  BoardPurchaseWithBoards,
  GameRoundSalesSummary,
  PurchaseBoardRpcRow,
  PurchaseBoardsInput
} from "@/modules/game/domain";
import {
  listBoardPurchasesByGameIds,
  listBoardPurchasesByUserId,
  listBoardsByPurchaseIds,
  purchaseBingoBoards
} from "@/modules/game/infrastructure";

function normalizeGameError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  if (!message) {
    return fallback;
  }

  if (message.includes("INSUFFICIENT_FUNDS")) {
    return "Saldo insuficiente para comprar tablas.";
  }

  if (message.includes("INVALID_BOARD_QUANTITY")) {
    return "Cantidad invalida. Solo se permite comprar 1, 5, 25 o 100 tablas.";
  }

  if (message.includes("BOARD_GENERATION_EXHAUSTED")) {
    return "No se pudieron generar tablas unicas. Intenta nuevamente.";
  }

  if (message.includes("CREDIT_MOVEMENT_NOT_ALLOWED")) {
    return "No se pudo procesar la compra por validacion de billetera.";
  }

  if (message.includes("BOARD_PURCHASE_BLOCKED_ROUND_ACTIVE")) {
    return "La partida actual ya inicio. Las compras estan bloqueadas hasta la siguiente ronda programada.";
  }

  if (message.includes("NO_SCHEDULED_GAME_ROUND_AVAILABLE")) {
    return "Aun no hay una proxima partida programada para comprar tablas.";
  }

  if (message.includes("BOARD_PURCHASE_WINDOW_CLOSED")) {
    return "El tiempo de compra para esta ronda ya cerro. Espera la proxima ronda programada.";
  }

  if (message.includes("MANUAL_GAME_SELECTION_NOT_ALLOWED")) {
    return "La asignacion de partida es automatica. No debes seleccionar manualmente la ronda.";
  }

  return message;
}

function assertGridIsValid(grid: unknown) {
  const parsed = bingoGridSchema.safeParse(grid);
  if (!parsed.success) {
    throw new Error("Se detecto una tabla generada con estructura invalida.");
  }
}

function mapRpcBoardRow(row: PurchaseBoardRpcRow): PurchaseBoardRpcRow {
  assertGridIsValid(row.grid);
  return row;
}

export async function purchaseBoardsForUser(
  input: PurchaseBoardsInput
): Promise<PurchaseBoardRpcRow[]> {
  const parsed = purchaseBoardsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de compra invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesion invalida. Inicia sesion nuevamente.");
  }

  const { data, error } = await purchaseBingoBoards(supabase, {
    quantity: parsed.data.quantity as PurchaseBoardsInput["quantity"],
    requestRef: parsed.data.requestRef,
    metadata: {
      channel: "web",
      initiated_by: user.id
    }
  });

  if (error || !data.length) {
    throw new Error(normalizeGameError(error, "No se pudo completar la compra de tablas."));
  }

  const validatedBoards = data.map(mapRpcBoardRow);
  return validatedBoards;
}

type PurchaseHistoryOptions = {
  purchasesLimit?: number;
  boardsLimit?: number;
};

export async function getBoardPurchaseHistoryByUserId(
  userId: string,
  options?: PurchaseHistoryOptions
): Promise<BoardPurchaseWithBoards[]> {
  const query = boardHistoryQuerySchema.safeParse({
    purchasesLimit: options?.purchasesLimit ?? 10,
    boardsLimit: options?.boardsLimit ?? 150
  });

  if (!query.success) {
    throw new Error("Parametros de historial de tablas invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: purchases, error: purchasesError } = await listBoardPurchasesByUserId(
    supabase,
    userId,
    query.data.purchasesLimit
  );

  if (purchasesError) {
    throw new Error(normalizeGameError(purchasesError, "No se pudo cargar compras de tablas."));
  }

  const purchaseIds = purchases.map((purchase) => purchase.id);
  const { data: boards, error: boardsError } = await listBoardsByPurchaseIds(
    supabase,
    purchaseIds,
    query.data.boardsLimit
  );

  if (boardsError) {
    throw new Error(normalizeGameError(boardsError, "No se pudieron cargar las tablas compradas."));
  }

  boards.forEach((board) => assertGridIsValid(board.grid));

  const boardsByPurchase = new Map<string, BingoBoardRow[]>();
  boards.forEach((board) => {
    const current = boardsByPurchase.get(board.purchaseId) ?? [];
    current.push(board);
    boardsByPurchase.set(board.purchaseId, current);
  });

  return purchases.map((purchase) => ({
    ...purchase,
    boards: boardsByPurchase.get(purchase.id) ?? []
  }));
}

export async function getGameRoundSalesSummary(
  gameRoundIds: string[]
): Promise<Map<string, GameRoundSalesSummary>> {
  const validIds = Array.from(new Set(gameRoundIds.filter((id) => id.trim().length > 0)));
  if (validIds.length === 0) {
    return new Map<string, GameRoundSalesSummary>();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listBoardPurchasesByGameIds(supabase, validIds);
  if (error) {
    throw new Error(normalizeGameError(error, "No se pudo cargar resumen de ventas por partida."));
  }

  const summaryMap = new Map<string, GameRoundSalesSummary>();
  validIds.forEach((gameRoundId) => {
    summaryMap.set(gameRoundId, {
      gameRoundId,
      purchasesCount: 0,
      boardsSold: 0,
      totalSales: 0
    });
  });

  data.forEach((purchase) => {
    if (!purchase.gameId) {
      return;
    }

    const current = summaryMap.get(purchase.gameId) ?? {
      gameRoundId: purchase.gameId,
      purchasesCount: 0,
      boardsSold: 0,
      totalSales: 0
    };

    current.purchasesCount += 1;
    current.boardsSold += purchase.quantity;
    current.totalSales += purchase.totalAmount;
    summaryMap.set(purchase.gameId, current);
  });

  return summaryMap;
}
