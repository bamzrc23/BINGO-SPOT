import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  adminAuditQuerySchema,
  adminSetUserStatusSchema,
  adminUpsertGameSettingSchema,
  adminUsersQuerySchema,
  adminWalletQuerySchema
} from "@/lib/validation";
import {
  ADMIN_DEFAULT_GAME_SETTINGS,
  type AdminAuditLogRow,
  type AdminAuditQueryInput,
  type AdminDashboardMetrics,
  type AdminSetUserStatusInput,
  type AdminUpsertGameSettingInput,
  type AdminUserWithWallet,
  type AdminUsersQueryInput,
  type AdminWalletTransaction,
  type GameSettingRow
} from "@/modules/admin/domain";
import {
  adminSetUserAccountStatus,
  getAdminDashboardMetrics,
  listAdminAuditLogs,
  listAdminUsersWithWallets,
  listAdminWalletTransactionsByUser,
  listGameSettings,
  upsertGameSetting
} from "@/modules/admin/infrastructure";
import type { Json } from "@/types/database";

function normalizeAdminError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  if (!message) {
    return fallback;
  }

  if (message.includes("ADMIN_ROLE_REQUIRED")) {
    return "Accion restringida a administradores.";
  }

  if (message.includes("PROFILE_NOT_FOUND")) {
    return "El usuario no existe o no tiene perfil.";
  }

  if (message.includes("SETTING_KEY_REQUIRED")) {
    return "La clave de configuracion es obligatoria.";
  }

  if (message.includes("SETTING_VALUE_REQUIRED")) {
    return "El valor de configuracion es obligatorio.";
  }

  return message;
}

function parseGameSettingValue(raw: string): Json {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;

    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }

    return trimmed;
  }
}

export async function getAdminDashboardMetricsData(): Promise<AdminDashboardMetrics> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await getAdminDashboardMetrics(supabase);

  if (error || !data) {
    throw new Error(normalizeAdminError(error, "No se pudieron cargar las metricas."));
  }

  return data;
}

export async function getAdminUsers(
  input: AdminUsersQueryInput = {}
): Promise<AdminUserWithWallet[]> {
  const parsed = adminUsersQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Filtros de usuarios invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listAdminUsersWithWallets(supabase, parsed.data);
  if (error) {
    throw new Error(normalizeAdminError(error, "No se pudo cargar el listado de usuarios."));
  }

  return data;
}

export async function getAdminUserWalletTransactions(input: {
  userId: string;
  limit?: number;
}): Promise<AdminWalletTransaction[]> {
  const parsed = adminWalletQuerySchema.safeParse({
    userId: input.userId,
    limit: input.limit ?? 30
  });

  if (!parsed.success) {
    throw new Error("Consulta de movimientos invalida.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listAdminWalletTransactionsByUser(supabase, parsed.data);
  if (error) {
    throw new Error(
      normalizeAdminError(error, "No se pudo cargar el historial de movimientos del usuario.")
    );
  }

  return data;
}

export async function setAdminUserStatus(input: AdminSetUserStatusInput): Promise<AdminUserWithWallet> {
  const parsed = adminSetUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Cambio de estado invalido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await adminSetUserAccountStatus(supabase, {
    userId: parsed.data.userId,
    accountStatus: parsed.data.accountStatus,
    reason: parsed.data.reason
  });

  if (error || !data) {
    throw new Error(normalizeAdminError(error, "No se pudo actualizar el estado del usuario."));
  }

  return data;
}

export async function getAdminGameSettings(): Promise<GameSettingRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await listGameSettings(supabase);
  if (error) {
    throw new Error(normalizeAdminError(error, "No se pudo cargar configuracion del juego."));
  }

  const existingByKey = new Map(data.map((item) => [item.key, item]));
  const merged = [...data];

  ADMIN_DEFAULT_GAME_SETTINGS.forEach((item) => {
    if (!existingByKey.has(item.key)) {
      merged.push({
        key: item.key,
        value: item.value,
        description: item.description,
        updatedBy: null,
        createdAt: "",
        updatedAt: ""
      });
    }
  });

  return merged.sort((a, b) => a.key.localeCompare(b.key));
}

export async function upsertAdminGameSetting(
  input: AdminUpsertGameSettingInput
): Promise<GameSettingRow> {
  const parsed = adminUpsertGameSettingSchema.safeParse({
    key: input.key,
    value: input.valueRaw,
    description: input.description
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Configuracion invalida.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await upsertGameSetting(supabase, {
    key: parsed.data.key,
    value: parseGameSettingValue(parsed.data.value),
    description: parsed.data.description
  });

  if (error || !data) {
    throw new Error(normalizeAdminError(error, "No se pudo guardar la configuracion."));
  }

  return data;
}

export async function getAdminAuditLogs(
  input: AdminAuditQueryInput = {}
): Promise<AdminAuditLogRow[]> {
  const parsed = adminAuditQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Consulta de auditoria invalida.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listAdminAuditLogs(supabase, parsed.data);
  if (error) {
    throw new Error(normalizeAdminError(error, "No se pudo cargar auditoria."));
  }

  return data;
}
