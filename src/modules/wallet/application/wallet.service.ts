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

function normalizeSupabaseError(error: { message?: string } | null | undefined, fallback: string) {
  if (!error?.message) {
    return fallback;
  }

  if (error.message.includes("INSUFFICIENT_FUNDS")) {
    return "Saldo insuficiente para completar la operacion.";
  }

  return error.message;
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
    transactions
  };
}
