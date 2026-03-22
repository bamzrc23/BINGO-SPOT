import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import type {
  WalletMutationInput,
  WalletMutationResult,
  WalletRow,
  WalletTransactionRow
} from "@/modules/wallet/domain";

type AppSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type WalletDbRow = Database["public"]["Tables"]["wallets"]["Row"];
type WalletTransactionDbRow = Database["public"]["Tables"]["wallet_transactions"]["Row"];

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

function mapWalletTransactionRow(row: WalletTransactionDbRow): WalletTransactionRow {
  return {
    id: row.id,
    walletId: row.wallet_id,
    userId: row.user_id,
    movementType: row.movement_type,
    direction: row.direction,
    amount: Number(row.amount),
    balanceBefore: Number(row.balance_before),
    balanceAfter: Number(row.balance_after),
    operationRef: row.operation_ref,
    operationSource: row.operation_source,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

export async function ensureWalletForUser(client: AppSupabaseClient, userId: string) {
  const { data, error } = await client.rpc("ensure_wallet_for_user", {
    p_user_id: userId
  });

  if (error) {
    return { data: null as WalletRow | null, error };
  }

  const wallet = Array.isArray(data) ? data[0] : data;
  return { data: wallet ? mapWalletRow(wallet) : null, error: null };
}

export async function getWalletByUserId(client: AppSupabaseClient, userId: string) {
  const { data, error } = await client
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { data: null as WalletRow | null, error };
  }

  return { data: data ? mapWalletRow(data) : null, error: null };
}

export async function listWalletTransactionsByUserId(
  client: AppSupabaseClient,
  userId: string,
  limit: number
) {
  const { data, error } = await client
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [] as WalletTransactionRow[], error };
  }

  return {
    data: (data ?? []).map(mapWalletTransactionRow),
    error: null
  };
}

export async function applyWalletMutation(client: AppSupabaseClient, input: WalletMutationInput) {
  const { data, error } = await client.rpc("apply_wallet_transaction", {
    p_user_id: input.userId,
    p_movement_type: input.movementType,
    p_direction: input.direction,
    p_amount: input.amount,
    p_operation_ref: input.operationRef ?? null,
    p_operation_source: input.operationSource ?? "system",
    p_metadata: (input.metadata ?? {}) as Json,
    p_created_by: input.createdBy ?? null
  });

  if (error) {
    return { data: null as WalletMutationResult | null, error };
  }

  const payload = Array.isArray(data) ? data[0] : null;
  if (!payload) {
    return {
      data: null as WalletMutationResult | null,
      error: {
        message: "La transaccion no devolvio resultado."
      }
    };
  }

  return {
    data: {
      transactionId: payload.transaction_id,
      walletId: payload.wallet_id,
      userId: payload.user_id,
      movementType: payload.movement_type,
      direction: payload.direction,
      amount: Number(payload.amount),
      balanceBefore: Number(payload.balance_before),
      balanceAfter: Number(payload.balance_after),
      operationRef: payload.operation_ref,
      createdAt: payload.created_at,
      wasAlreadyProcessed: payload.was_already_processed
    } satisfies WalletMutationResult,
    error: null
  };
}
