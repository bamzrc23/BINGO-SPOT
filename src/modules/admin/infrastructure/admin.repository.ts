import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";
import type {
  AdminAuditLogRow,
  AdminBoardSalesBreakdown,
  AdminAuditQueryInput,
  AdminDashboardMetrics,
  AdminSetUserStatusInput,
  AdminUserWithWallet,
  AdminUsersQueryInput,
  AdminWalletTransaction,
  GameSettingRow
} from "@/modules/admin/domain";

type AppSupabaseClient = SupabaseClient<Database>;
type GameSettingDbRow = Database["public"]["Tables"]["game_settings"]["Row"];

function getRpcSingle<T>(data: T[] | T | null): T | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

function mapGameSettingRow(row: GameSettingDbRow): GameSettingRow {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function mapBoardSalesBreakdown(value: Json | null | undefined): AdminBoardSalesBreakdown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const row = item as Record<string, unknown>;
      return {
        stakeTier: typeof row.stake_tier === "string" ? row.stake_tier : "unknown",
        unitPrice: toNumber(row.unit_price),
        purchasesCount: Math.max(0, Math.trunc(toNumber(row.purchases_count))),
        boardsSold: Math.max(0, Math.trunc(toNumber(row.boards_sold))),
        salesTotal: toNumber(row.sales_total)
      } satisfies AdminBoardSalesBreakdown;
    })
    .filter((item): item is AdminBoardSalesBreakdown => item !== null);
}

export async function getAdminDashboardMetrics(client: AppSupabaseClient) {
  const { data, error } = await client.rpc("admin_get_dashboard_metrics");
  if (error) {
    return { data: null as AdminDashboardMetrics | null, error };
  }

  const row = getRpcSingle(data);
  if (!row) {
    return { data: null as AdminDashboardMetrics | null, error: null };
  }

  return {
    data: {
      usersTotal: row.users_total,
      usersActive: row.users_active,
      usersSuspended: row.users_suspended,
      topupsPending: row.topups_pending,
      withdrawalsPending: row.withdrawals_pending,
      activeRoundId: row.active_round_id,
      boardsSoldTotal: row.boards_sold_total,
      boardsRevenueTotal: Number(row.boards_revenue_total),
      prizesPaidTotal: Number(row.prizes_paid_total),
      netGamingResultTotal: Number(row.net_gaming_result_total),
      boardSalesBreakdown: mapBoardSalesBreakdown(row.board_sales_breakdown)
    } satisfies AdminDashboardMetrics,
    error: null
  };
}

export async function listAdminUsersWithWallets(
  client: AppSupabaseClient,
  input: AdminUsersQueryInput
) {
  const { data, error } = await client.rpc("admin_list_users_with_wallets", {
    p_search: input.search ?? null,
    p_role: input.role ?? null,
    p_status: input.accountStatus ?? null,
    p_limit: input.limit ?? 60,
    p_offset: input.offset ?? 0
  });

  if (error) {
    return { data: [] as AdminUserWithWallet[], error };
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    role: row.role,
    accountStatus: row.account_status,
    createdAt: row.created_at,
    walletBalance: Number(row.wallet_balance),
    walletLockedBalance: Number(row.wallet_locked_balance),
    walletUpdatedAt: row.wallet_updated_at,
    walletTxCount: row.wallet_tx_count,
    lastWalletTxAt: row.last_wallet_tx_at
  })) satisfies AdminUserWithWallet[];

  return { data: rows, error: null };
}

export async function adminSetUserAccountStatus(
  client: AppSupabaseClient,
  input: AdminSetUserStatusInput
) {
  const { data, error } = await client.rpc("admin_set_user_account_status", {
    p_user_id: input.userId,
    p_status: input.accountStatus,
    p_reason: input.reason ?? null
  });

  if (error) {
    return { data: null as AdminUserWithWallet | null, error };
  }

  const row = getRpcSingle(data);
  if (!row) {
    return { data: null as AdminUserWithWallet | null, error: null };
  }

  return {
    data: {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      nickname: row.nickname,
      email: row.email,
      phone: row.phone,
      role: row.role,
      accountStatus: row.account_status,
      createdAt: row.created_at,
      walletBalance: 0,
      walletLockedBalance: 0,
      walletUpdatedAt: null,
      walletTxCount: 0,
      lastWalletTxAt: null
    } satisfies AdminUserWithWallet,
    error: null
  };
}

export async function listAdminWalletTransactionsByUser(
  client: AppSupabaseClient,
  input: {
    userId: string;
    limit: number;
  }
) {
  const { data, error } = await client.rpc("admin_list_wallet_transactions", {
    p_user_id: input.userId,
    p_limit: input.limit
  });

  if (error) {
    return { data: [] as AdminWalletTransaction[], error };
  }

  const rows = (data ?? []).map((row) => ({
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
  })) satisfies AdminWalletTransaction[];

  return { data: rows, error: null };
}

export async function listGameSettings(client: AppSupabaseClient) {
  const { data, error } = await client
    .from("game_settings")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    return { data: [] as GameSettingRow[], error };
  }

  return {
    data: (data ?? []).map(mapGameSettingRow),
    error: null
  };
}

export async function upsertGameSetting(
  client: AppSupabaseClient,
  input: {
    key: string;
    value: Json;
    description?: string;
  }
) {
  const { data, error } = await client.rpc("admin_upsert_game_setting", {
    p_key: input.key,
    p_value: input.value,
    p_description: input.description ?? null
  });

  if (error) {
    return { data: null as GameSettingRow | null, error };
  }

  const row = getRpcSingle(data);
  return { data: row ? mapGameSettingRow(row) : null, error: null };
}

export async function listAdminAuditLogs(
  client: AppSupabaseClient,
  input: AdminAuditQueryInput
) {
  const { data, error } = await client.rpc("admin_list_audit_logs", {
    p_action: input.action ?? null,
    p_entity_type: input.entityType ?? null,
    p_limit: input.limit ?? 120,
    p_offset: input.offset ?? 0
  });

  if (error) {
    return { data: [] as AdminAuditLogRow[], error };
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorNickname: row.actor_nickname,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    createdAt: row.created_at
  })) satisfies AdminAuditLogRow[];

  return { data: rows, error: null };
}
