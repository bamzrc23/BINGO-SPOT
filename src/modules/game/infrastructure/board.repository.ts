import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import type {
  BingoBoardRow,
  BoardPurchaseRow,
  PurchaseBoardRpcRow,
  PurchaseBoardsInput
} from "@/modules/game/domain";

type AppSupabaseClient = SupabaseClient<Database>;
type BoardPurchaseDbRow = Database["public"]["Tables"]["board_purchases"]["Row"];
type BingoBoardDbRow = Database["public"]["Tables"]["bingo_boards"]["Row"];

function mapBoardPurchaseRow(row: BoardPurchaseDbRow): BoardPurchaseRow {
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

function mapBingoBoardRow(row: BingoBoardDbRow): BingoBoardRow {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    userId: row.user_id,
    gameId: row.game_id,
    boardIndex: row.board_index,
    boardFingerprint: row.board_fingerprint,
    grid: row.grid as BingoBoardRow["grid"],
    createdAt: row.created_at
  };
}

export async function purchaseBingoBoards(client: AppSupabaseClient, input: PurchaseBoardsInput) {
  const { data, error } = await client.rpc("purchase_bingo_boards", {
    p_quantity: input.quantity,
    p_game_id: null,
    p_request_ref: input.requestRef ?? null,
    p_metadata: (input.metadata ?? {}) as Json
  });

  if (error) {
    return { data: [] as PurchaseBoardRpcRow[], error };
  }

  const rows = (data ?? []).map((row) => ({
    purchaseId: row.purchase_id,
    boardId: row.board_id,
    boardIndex: row.board_index,
    boardFingerprint: row.board_fingerprint,
    grid: row.grid as PurchaseBoardRpcRow["grid"],
    walletTransactionId: row.wallet_transaction_id,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount)
  }));

  return { data: rows, error: null };
}

export async function listBoardPurchasesByUserId(
  client: AppSupabaseClient,
  userId: string,
  limit: number
) {
  const { data, error } = await client
    .from("board_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [] as BoardPurchaseRow[], error };
  }

  return { data: (data ?? []).map(mapBoardPurchaseRow), error: null };
}

export async function listBoardPurchasesByGameIds(
  client: AppSupabaseClient,
  gameIds: string[]
) {
  if (gameIds.length === 0) {
    return { data: [] as BoardPurchaseRow[], error: null };
  }

  const { data, error } = await client
    .from("board_purchases")
    .select("*")
    .in("game_id", gameIds)
    .eq("status", "completed");

  if (error) {
    return { data: [] as BoardPurchaseRow[], error };
  }

  return { data: (data ?? []).map(mapBoardPurchaseRow), error: null };
}

export async function listBoardsByPurchaseIds(
  client: AppSupabaseClient,
  purchaseIds: string[],
  limit: number
) {
  if (purchaseIds.length === 0) {
    return { data: [] as BingoBoardRow[], error: null };
  }

  const { data, error } = await client
    .from("bingo_boards")
    .select("*")
    .in("purchase_id", purchaseIds)
    .order("purchase_id", { ascending: false })
    .order("board_index", { ascending: true })
    .limit(limit);

  if (error) {
    return { data: [] as BingoBoardRow[], error };
  }

  return { data: (data ?? []).map(mapBingoBoardRow), error: null };
}
