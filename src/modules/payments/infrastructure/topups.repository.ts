import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  ApplyPayphoneResultInput,
  CreateBankTransferTopupInput,
  CreatePayphoneTopupInput,
  ReviewBankTransferTopupInput,
  TopupEventRow,
  TopupRow,
  TopupRowWithReceiptUrl
} from "@/modules/payments/domain";
import {
  TOPUP_RECEIPTS_BUCKET,
  TOPUP_RECEIPTS_SIGNED_URL_SECONDS
} from "@/modules/payments/domain";

type AppSupabaseClient = SupabaseClient<Database>;
type TopupDbRow = Database["public"]["Tables"]["topups"]["Row"];
type TopupEventDbRow = Database["public"]["Tables"]["topup_events"]["Row"];

function mapTopupRow(row: TopupDbRow): TopupRow {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    providerReference: row.provider_reference,
    clientReference: row.client_reference,
    receiptPath: row.receipt_path,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    walletTransactionId: row.wallet_transaction_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTopupEventRow(row: TopupEventDbRow): TopupEventRow {
  return {
    id: row.id,
    topupId: row.topup_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    previousStatus: row.previous_status,
    currentStatus: row.current_status,
    notes: row.notes,
    payload: row.payload,
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

export async function listTopupsByUserId(
  client: AppSupabaseClient,
  userId: string,
  limit: number
) {
  const { data, error } = await client
    .from("topups")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [] as TopupRow[], error };
  }

  return { data: (data ?? []).map(mapTopupRow), error: null };
}

export async function listTopupEventsByUserId(
  client: AppSupabaseClient,
  userId: string,
  limit: number
) {
  const { data, error } = await client
    .from("topup_events")
    .select("*, topups!inner(user_id)")
    .eq("topups.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [] as TopupEventRow[], error };
  }

  const mapped = (data ?? [])
    .map((row) => {
      const eventRow = row as unknown as TopupEventDbRow;
      return mapTopupEventRow(eventRow);
    })
    .slice(0, limit);

  return { data: mapped, error: null };
}

export async function listTopupsForAdmin(
  client: AppSupabaseClient,
  options: {
    provider?: TopupDbRow["provider"];
    status?: TopupDbRow["status"];
    limit: number;
  }
) {
  let query = client.from("topups").select("*").order("created_at", { ascending: false });

  if (options.provider) {
    query = query.eq("provider", options.provider);
  }

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query.limit(options.limit);
  if (error) {
    return { data: [] as TopupRow[], error };
  }

  return { data: (data ?? []).map(mapTopupRow), error: null };
}

export async function createPayphoneTopup(
  client: AppSupabaseClient,
  input: CreatePayphoneTopupInput
) {
  const { data, error } = await client.rpc("create_topup_payphone_intent", {
    p_amount: input.amount,
    p_client_reference: input.clientReference ?? null,
    p_payload: (input.payload ?? {}) as Json
  });

  if (error) {
    return { data: null as TopupRow | null, error };
  }

  const topup = getRpcSingle(data);
  return { data: topup ? mapTopupRow(topup) : null, error: null };
}

export async function createBankTransferTopup(
  client: AppSupabaseClient,
  input: CreateBankTransferTopupInput
) {
  const { data, error } = await client.rpc("create_topup_bank_transfer", {
    p_amount: input.amount,
    p_client_reference: input.clientReference ?? null,
    p_receipt_path: input.receiptPath,
    p_payload: (input.payload ?? {}) as Json
  });

  if (error) {
    return { data: null as TopupRow | null, error };
  }

  const topup = getRpcSingle(data);
  return { data: topup ? mapTopupRow(topup) : null, error: null };
}

export async function reviewBankTransferTopup(
  client: AppSupabaseClient,
  input: ReviewBankTransferTopupInput
) {
  const { data, error } = await client.rpc("review_topup_bank_transfer", {
    p_topup_id: input.topupId,
    p_decision: input.decision,
    p_rejection_reason: input.rejectionReason ?? null,
    p_payload: (input.payload ?? {}) as Json
  });

  if (error) {
    return { data: null as TopupRow | null, error };
  }

  const topup = getRpcSingle(data);
  return { data: topup ? mapTopupRow(topup) : null, error: null };
}

export async function applyPayphoneResult(
  client: AppSupabaseClient,
  input: ApplyPayphoneResultInput
) {
  const { data, error } = await client.rpc("apply_topup_payphone_result", {
    p_topup_id: input.topupId,
    p_provider_reference: input.providerReference ?? null,
    p_approved: input.approved,
    p_rejection_reason: input.rejectionReason ?? null,
    p_payload: (input.payload ?? {}) as Json
  });

  if (error) {
    return { data: null as TopupRow | null, error };
  }

  const topup = getRpcSingle(data);
  return { data: topup ? mapTopupRow(topup) : null, error: null };
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function uploadTopupReceipt(
  client: AppSupabaseClient,
  userId: string,
  file: File
) {
  const safeName = sanitizeFileName(file.name || "receipt");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { data, error } = await client.storage.from(TOPUP_RECEIPTS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream"
  });

  if (error) {
    return { data: null as string | null, error };
  }

  return { data: data.path, error: null };
}

export async function createReceiptSignedUrl(
  client: AppSupabaseClient,
  receiptPath: string
) {
  const { data, error } = await client
    .storage
    .from(TOPUP_RECEIPTS_BUCKET)
    .createSignedUrl(receiptPath, TOPUP_RECEIPTS_SIGNED_URL_SECONDS);

  if (error) {
    return { data: null as string | null, error };
  }

  return { data: data.signedUrl, error: null };
}

export async function deleteReceiptByPath(client: AppSupabaseClient, receiptPath: string) {
  const { error } = await client.storage.from(TOPUP_RECEIPTS_BUCKET).remove([receiptPath]);
  return { error: error ?? null };
}

export async function attachReceiptUrls(
  client: AppSupabaseClient,
  topups: TopupRow[]
): Promise<TopupRowWithReceiptUrl[]> {
  const withUrls = await Promise.all(
    topups.map(async (topup) => {
      if (!topup.receiptPath) {
        return {
          ...topup,
          receiptSignedUrl: null
        };
      }

      const { data } = await createReceiptSignedUrl(client, topup.receiptPath);
      return {
        ...topup,
        receiptSignedUrl: data
      };
    })
  );

  return withUrls;
}
