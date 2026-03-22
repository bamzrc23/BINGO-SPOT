import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import type {
  CreateWithdrawalRequestInput,
  MarkWithdrawalPaidInput,
  ReviewWithdrawalInput,
  WithdrawalEventRow,
  WithdrawalFeeQuote,
  WithdrawalFeeRuleRow,
  WithdrawalRow
} from "@/modules/withdrawals/domain";

type AppSupabaseClient = SupabaseClient<Database>;
type WithdrawalDbRow = Database["public"]["Tables"]["withdrawals"]["Row"];
type WithdrawalEventDbRow = Database["public"]["Tables"]["withdrawal_events"]["Row"];
type WithdrawalFeeRuleDbRow = Database["public"]["Tables"]["withdrawal_fee_rules"]["Row"];

function mapWithdrawalRow(row: WithdrawalDbRow): WithdrawalRow {
  return {
    id: row.id,
    userId: row.user_id,
    bankName: row.bank_name,
    bankNormalized: row.bank_normalized,
    accountType: row.account_type,
    accountNumber: row.account_number,
    accountHolderName: row.account_holder_name,
    accountHolderId: row.account_holder_id,
    amountRequested: Number(row.amount_requested),
    feeApplied: Number(row.fee_applied),
    amountNet: Number(row.amount_net),
    lockedAmount: Number(row.locked_amount),
    status: row.status,
    adminObservation: row.admin_observation,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    approvedAt: row.approved_at,
    paidAt: row.paid_at,
    rejectedAt: row.rejected_at,
    walletTransactionId: row.wallet_transaction_id,
    externalReference: row.external_reference,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapWithdrawalEventRow(row: WithdrawalEventDbRow): WithdrawalEventRow {
  return {
    id: row.id,
    withdrawalId: row.withdrawal_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    currentStatus: row.current_status,
    notes: row.notes,
    payload: row.payload,
    createdAt: row.created_at
  };
}

function mapWithdrawalFeeRuleRow(row: WithdrawalFeeRuleDbRow): WithdrawalFeeRuleRow {
  return {
    id: row.id,
    bankNormalized: row.bank_normalized,
    fee: Number(row.fee),
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

export async function getWithdrawalFeeQuote(
  client: AppSupabaseClient,
  bankName: string,
  amountRequested: number
) {
  const { data, error } = await client.rpc("get_withdrawal_fee_quote", {
    p_bank_name: bankName,
    p_amount_requested: amountRequested
  });

  if (error) {
    return { data: null as WithdrawalFeeQuote | null, error };
  }

  const quote = getRpcSingle(data);
  if (!quote) {
    return {
      data: null as WithdrawalFeeQuote | null,
      error: {
        message: "No se pudo calcular la comision del retiro."
      }
    };
  }

  return {
    data: {
      bankNormalized: quote.bank_normalized,
      feeApplied: Number(quote.fee_applied),
      amountNet: Number(quote.amount_net)
    } satisfies WithdrawalFeeQuote,
    error: null
  };
}

export async function listWithdrawalsByUserId(
  client: AppSupabaseClient,
  userId: string,
  limit: number,
  status?: WithdrawalDbRow["status"]
) {
  let query = client
    .from("withdrawals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    return { data: [] as WithdrawalRow[], error };
  }

  return { data: (data ?? []).map(mapWithdrawalRow), error: null };
}

export async function listWithdrawalsForAdmin(
  client: AppSupabaseClient,
  options: {
    limit: number;
    status?: WithdrawalDbRow["status"];
  }
) {
  let query = client.from("withdrawals").select("*").order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query.limit(options.limit);
  if (error) {
    return { data: [] as WithdrawalRow[], error };
  }

  return { data: (data ?? []).map(mapWithdrawalRow), error: null };
}

export async function createWithdrawalRequest(
  client: AppSupabaseClient,
  input: CreateWithdrawalRequestInput
) {
  const { data, error } = await client.rpc("create_withdrawal_request", {
    p_bank_name: input.bankName,
    p_account_type: input.accountType,
    p_account_number: input.accountNumber,
    p_account_holder_name: input.accountHolderName,
    p_account_holder_id: input.accountHolderId,
    p_amount_requested: input.amountRequested,
    p_metadata: (input.metadata ?? {}) as Json
  });

  if (error) {
    return { data: null as WithdrawalRow | null, error };
  }

  const withdrawal = getRpcSingle(data);
  return { data: withdrawal ? mapWithdrawalRow(withdrawal) : null, error: null };
}

export async function reviewWithdrawalRequest(
  client: AppSupabaseClient,
  input: ReviewWithdrawalInput
) {
  const { data, error } = await client.rpc("review_withdrawal_request", {
    p_withdrawal_id: input.withdrawalId,
    p_decision: input.decision,
    p_observation: input.observation ?? null,
    p_rejection_reason: input.rejectionReason ?? null,
    p_payload: (input.payload ?? {}) as Json
  });

  if (error) {
    return { data: null as WithdrawalRow | null, error };
  }

  const withdrawal = getRpcSingle(data);
  return { data: withdrawal ? mapWithdrawalRow(withdrawal) : null, error: null };
}

export async function markWithdrawalPaid(
  client: AppSupabaseClient,
  input: MarkWithdrawalPaidInput
) {
  const { data, error } = await client.rpc("mark_withdrawal_paid", {
    p_withdrawal_id: input.withdrawalId,
    p_observation: input.observation ?? null,
    p_external_reference: input.externalReference ?? null,
    p_payload: (input.payload ?? {}) as Json
  });

  if (error) {
    return { data: null as WithdrawalRow | null, error };
  }

  const withdrawal = getRpcSingle(data);
  return { data: withdrawal ? mapWithdrawalRow(withdrawal) : null, error: null };
}

export async function listWithdrawalEventsByUserId(
  client: AppSupabaseClient,
  userId: string,
  limit: number
) {
  const { data, error } = await client
    .from("withdrawal_events")
    .select("*, withdrawals!inner(user_id)")
    .eq("withdrawals.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [] as WithdrawalEventRow[], error };
  }

  const mapped = (data ?? [])
    .map((row) => mapWithdrawalEventRow(row as unknown as WithdrawalEventDbRow))
    .slice(0, limit);

  return { data: mapped, error: null };
}

export async function listWithdrawalFeeRules(client: AppSupabaseClient) {
  const { data, error } = await client
    .from("withdrawal_fee_rules")
    .select("*")
    .order("bank_normalized", { ascending: true });

  if (error) {
    return { data: [] as WithdrawalFeeRuleRow[], error };
  }

  return { data: (data ?? []).map(mapWithdrawalFeeRuleRow), error: null };
}
