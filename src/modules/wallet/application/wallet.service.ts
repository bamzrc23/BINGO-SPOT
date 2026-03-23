import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  applyWalletTransactionSchema,
  walletHistoryQuerySchema
} from "@/lib/validation";
import type { WalletMutationInput, WalletMutationResult, WalletSnapshot } from "@/modules/wallet/domain";
import {
  applyWalletMutation,
  ensureWalletForUser,
  listWalletTransactionsByUserId
} from "@/modules/wallet/infrastructure";
import type { WalletMovementType } from "@/types/domain";
import type { Json } from "@/types/database";

function normalizeSupabaseError(error: { message?: string } | null | undefined, fallback: string) {
  if (!error?.message) {
    return fallback;
  }

  if (error.message.includes("INSUFFICIENT_FUNDS")) {
    return "Saldo insuficiente para completar la operacion.";
  }

  return error.message;
}

type JsonObject = {
  [key: string]: Json | undefined;
};

function asJsonObject(value: Json): JsonObject | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return null;
}

function getPrizeRoundIdFromMetadata(metadata: Json): string | null {
  const jsonObject = asJsonObject(metadata);
  if (!jsonObject) {
    return null;
  }

  const roundId = jsonObject.game_round_id;
  return typeof roundId === "string" && roundId.length > 0 ? roundId : null;
}

function consolidatePrizeTransactionsByRound(transactions: WalletSnapshot["transactions"]) {
  const rowsByRoundId = new Map<string, WalletSnapshot["transactions"]>();

  transactions.forEach((tx) => {
    if (tx.movementType !== "prize" || tx.direction !== "credit") {
      return;
    }

    const roundId = getPrizeRoundIdFromMetadata(tx.metadata);
    if (!roundId) {
      return;
    }

    const current = rowsByRoundId.get(roundId) ?? [];
    current.push(tx);
    rowsByRoundId.set(roundId, current);
  });

  const emittedRoundIds = new Set<string>();

  return transactions.reduce<WalletSnapshot["transactions"]>((acc, tx) => {
    if (tx.movementType !== "prize" || tx.direction !== "credit") {
      acc.push(tx);
      return acc;
    }

    const roundId = getPrizeRoundIdFromMetadata(tx.metadata);
    if (!roundId) {
      acc.push(tx);
      return acc;
    }

    if (emittedRoundIds.has(roundId)) {
      return acc;
    }

    emittedRoundIds.add(roundId);
    const rows = rowsByRoundId.get(roundId) ?? [tx];
    const rowsByCreatedAsc = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const oldest = rowsByCreatedAsc[0] ?? tx;
    const newest = rowsByCreatedAsc[rowsByCreatedAsc.length - 1] ?? tx;
    const totalAmount =
      Math.round(rowsByCreatedAsc.reduce((sum, row) => sum + Math.round(row.amount * 100), 0)) / 100;
    const lineCount = rowsByCreatedAsc.length;

    acc.push({
      id: `prize-round:${roundId}`,
      walletId: newest.walletId,
      userId: newest.userId,
      movementType: "prize",
      direction: "credit",
      amount: totalAmount,
      balanceBefore: oldest.balanceBefore,
      balanceAfter: newest.balanceAfter,
      operationRef: `Partida #${roundId.slice(0, 8)} (${lineCount} linea${lineCount === 1 ? "" : "s"})`,
      operationSource: newest.operationSource,
      metadata: {
        ...(asJsonObject(newest.metadata) ?? {}),
        game_round_id: roundId,
        aggregated_line_count: lineCount,
        is_round_total: true
      },
      createdBy: newest.createdBy,
      createdAt: newest.createdAt
    });

    return acc;
  }, []);
}

type ApplyWalletInput = {
  userId: string;
  movementType: WalletMovementType;
  direction: "credit" | "debit";
  amount: number;
  operationRef?: string;
  operationSource?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export async function applyWalletTransaction(input: ApplyWalletInput): Promise<WalletMutationResult> {
  const parsed = applyWalletTransactionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Movimiento de billetera invalido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await applyWalletMutation(
    supabase,
    parsed.data as WalletMutationInput
  );

  if (error || !data) {
    throw new Error(
      normalizeSupabaseError(error, "No se pudo registrar el movimiento de billetera.")
    );
  }

  return data;
}

type CreditWalletInput = Omit<ApplyWalletInput, "direction">;
type DebitWalletInput = Omit<ApplyWalletInput, "direction">;

export async function creditWallet(input: CreditWalletInput): Promise<WalletMutationResult> {
  return applyWalletTransaction({
    ...input,
    direction: "credit"
  });
}

export async function debitWallet(input: DebitWalletInput): Promise<WalletMutationResult> {
  return applyWalletTransaction({
    ...input,
    direction: "debit"
  });
}

export async function getWalletSnapshotByUserId(
  userId: string,
  options?: {
    limit?: number;
  }
): Promise<WalletSnapshot> {
  const query = walletHistoryQuerySchema.safeParse({
    limit: options?.limit ?? 20
  });

  if (!query.success) {
    throw new Error("Parametros de consulta de billetera invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: wallet, error: walletError } = await ensureWalletForUser(supabase, userId);
  if (walletError || !wallet) {
    throw new Error(normalizeSupabaseError(walletError, "No se pudo cargar la billetera."));
  }

  const { data: transactions, error: transactionsError } = await listWalletTransactionsByUserId(
    supabase,
    userId,
    query.data.limit
  );

  if (transactionsError) {
    throw new Error(
      normalizeSupabaseError(
        transactionsError,
        "No se pudo cargar el historial de movimientos."
      )
    );
  }

  return {
    wallet,
    transactions: consolidatePrizeTransactionsByRound(transactions)
  };
}
