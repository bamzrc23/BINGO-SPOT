import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createVerificationCode } from "@/lib/utils";
import {
  withdrawalAdminReviewSchema,
  withdrawalFeeQuoteSchema,
  withdrawalHistoryQuerySchema,
  withdrawalMarkPaidSchema,
  withdrawalRequestSchema
} from "@/lib/validation";
import type {
  CreateWithdrawalRequestInput,
  MarkWithdrawalPaidInput,
  ReviewWithdrawalInput,
  WithdrawalFeeQuote,
  WithdrawalFeeRuleRow,
  WithdrawalRow
} from "@/modules/withdrawals/domain";
import {
  createWithdrawalRequest,
  getWithdrawalFeeQuote,
  listWithdrawalFeeRules,
  listWithdrawalsByUserId,
  listWithdrawalsForAdmin,
  markWithdrawalPaid,
  reviewWithdrawalRequest
} from "@/modules/withdrawals/infrastructure";

function normalizeWithdrawalError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  if (!message) {
    return fallback;
  }

  if (message.includes("INSUFFICIENT_AVAILABLE_BALANCE")) {
    return "No tienes saldo disponible suficiente para solicitar este retiro.";
  }

  if (message.includes("AMOUNT_LESS_OR_EQUAL_FEE")) {
    return "El monto solicitado debe ser mayor que la comision.";
  }

  if (message.includes("LOCKED_BALANCE_MISMATCH")) {
    return "No se pudo validar el saldo reservado. Intenta nuevamente.";
  }

  if (message.includes("WITHDRAWAL_NOT_FOUND")) {
    return "La solicitud de retiro no existe.";
  }

  if (message.includes("WITHDRAWAL_NOT_APPROVED")) {
    return "Solo se puede marcar como pagado un retiro aprobado.";
  }

  if (message.includes("REJECTION_REASON_REQUIRED")) {
    return "Debes indicar el motivo de rechazo.";
  }

  if (message.includes("ADMIN_ROLE_REQUIRED")) {
    return "No tienes permisos para esta operacion.";
  }

  if (message.includes("BANK_NAME_REQUIRED")) {
    return "Debes indicar el banco de destino.";
  }

  return message;
}

type ListWithdrawalsOptions = {
  limit?: number;
  status?: "pending" | "approved" | "paid" | "rejected";
};

function normalizeQueryLimit(limit: number | undefined, fallback: number): number {
  const raw = typeof limit === "number" && Number.isFinite(limit) ? Math.trunc(limit) : fallback;
  return Math.min(Math.max(raw, 1), 100);
}

type CreateWithdrawalRequestResult = {
  withdrawal: WithdrawalRow;
  verificationCode: string;
};

export async function getWithdrawalFeeQuoteForUser(
  bankName: string,
  amountRequested: number
): Promise<WithdrawalFeeQuote> {
  const parsed = withdrawalFeeQuoteSchema.safeParse({
    bankName,
    amountRequested
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos invalidos para calcular la comision.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await getWithdrawalFeeQuote(
    supabase,
    parsed.data.bankName,
    parsed.data.amountRequested
  );

  if (error || !data) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo calcular la comision de retiro."));
  }

  return data;
}

export async function getWithdrawalsByUserId(
  userId: string,
  options?: ListWithdrawalsOptions
): Promise<WithdrawalRow[]> {
  const safeLimit = normalizeQueryLimit(options?.limit, 30);
  const query = withdrawalHistoryQuerySchema.safeParse({
    limit: safeLimit,
    status: options?.status
  });

  if (!query.success) {
    throw new Error("Parametros de consulta de retiros invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listWithdrawalsByUserId(
    supabase,
    userId,
    query.data.limit,
    query.data.status
  );

  if (error) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo cargar tu historial de retiros."));
  }

  return data;
}

export async function getWithdrawalsForAdmin(options?: ListWithdrawalsOptions): Promise<WithdrawalRow[]> {
  const safeLimit = normalizeQueryLimit(options?.limit, 60);
  const query = withdrawalHistoryQuerySchema.safeParse({
    limit: safeLimit,
    status: options?.status
  });

  if (!query.success) {
    throw new Error("Parametros de consulta invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listWithdrawalsForAdmin(supabase, {
    limit: query.data.limit,
    status: query.data.status
  });

  if (error) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo cargar la bandeja de retiros."));
  }

  return data;
}

export async function getWithdrawalFeeRulesForAdmin(): Promise<WithdrawalFeeRuleRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await listWithdrawalFeeRules(supabase);
  if (error) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo cargar reglas de comision."));
  }

  return data;
}

export async function createWithdrawalRequestForUser(
  input: CreateWithdrawalRequestInput
): Promise<CreateWithdrawalRequestResult> {
  const parsed = withdrawalRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de retiro invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesion invalida. Inicia sesion nuevamente.");
  }

  const verificationCode = createVerificationCode("RET");

  const { data, error } = await createWithdrawalRequest(supabase, {
    ...parsed.data,
    metadata: {
      ...(input.metadata ?? {}),
      channel: "web",
      initiated_by: user.id,
      verification_code: verificationCode
    }
  });

  if (error || !data) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo crear la solicitud de retiro."));
  }

  return {
    withdrawal: data,
    verificationCode
  };
}

export async function reviewWithdrawalByAdmin(input: ReviewWithdrawalInput): Promise<WithdrawalRow> {
  const parsed = withdrawalAdminReviewSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de revision invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await reviewWithdrawalRequest(supabase, {
    withdrawalId: parsed.data.withdrawalId,
    decision: parsed.data.decision,
    observation: parsed.data.observation,
    rejectionReason: parsed.data.rejectionReason,
    payload: input.payload
  });

  if (error || !data) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo revisar la solicitud."));
  }

  return data;
}

export async function markWithdrawalAsPaidByAdmin(
  input: MarkWithdrawalPaidInput
): Promise<WithdrawalRow> {
  const parsed = withdrawalMarkPaidSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos para pago invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await markWithdrawalPaid(supabase, {
    withdrawalId: parsed.data.withdrawalId,
    observation: parsed.data.observation,
    externalReference: parsed.data.externalReference,
    payload: input.payload
  });

  if (error || !data) {
    throw new Error(normalizeWithdrawalError(error, "No se pudo marcar el retiro como pagado."));
  }

  return data;
}
