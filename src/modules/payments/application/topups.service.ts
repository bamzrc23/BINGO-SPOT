import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createVerificationCode } from "@/lib/utils";
import {
  adminTopupReviewSchema,
  createPayphoneTopupSchema,
  payphoneWebhookResultSchema,
  topupHistoryQuerySchema
} from "@/lib/validation";
import type {
  ApplyPayphoneResultInput,
  ReviewBankTransferTopupInput,
  TopupRow,
  TopupRowWithReceiptUrl
} from "@/modules/payments/domain";
import type { CreatePayphoneTopupInput } from "@/modules/payments/domain";
import {
  applyPayphoneResult,
  attachReceiptUrls,
  createBankTransferTopup,
  createPayphoneTopup,
  listTopupsByUserId,
  listTopupsForAdmin,
  reviewBankTransferTopup,
} from "@/modules/payments/infrastructure";
import type { Database } from "@/types/database";

function normalizeTopupError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? "";
  if (!message) {
    return fallback;
  }

  if (message.includes("AMOUNT_MUST_BE_POSITIVE")) {
    return "El monto debe ser mayor a cero.";
  }

  if (message.includes("RECEIPT_REQUIRED")) {
    return "Debes subir un comprobante para la transferencia.";
  }

  if (message.includes("TOPUP_NOT_FOUND")) {
    return "La recarga no existe o no esta disponible.";
  }

  if (message.includes("REJECTION_REASON_REQUIRED")) {
    return "Debes indicar un motivo de rechazo.";
  }

  if (message.includes("ADMIN_ROLE_REQUIRED")) {
    return "No tienes permisos para ejecutar esta accion.";
  }

  if (message.includes("CREDIT_MOVEMENT_NOT_ALLOWED")) {
    return "No se permite acreditar saldo de forma directa.";
  }

  return message;
}

function sanitizeTopupReason(reason?: string): string | null {
  if (!reason) {
    return null;
  }

  const normalized = reason.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > 300) {
    throw new Error("El motivo no puede superar 300 caracteres.");
  }

  return normalized;
}

type ListTopupsOptions = {
  limit?: number;
};

export async function getTopupsByUserId(
  userId: string,
  options?: ListTopupsOptions
): Promise<TopupRowWithReceiptUrl[]> {
  const query = topupHistoryQuerySchema.safeParse({
    limit: options?.limit ?? 30
  });

  if (!query.success) {
    throw new Error("Parametros de consulta de recargas invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listTopupsByUserId(supabase, userId, query.data.limit);
  if (error) {
    throw new Error(normalizeTopupError(error, "No se pudo cargar tu historial de recargas."));
  }

  return attachReceiptUrls(supabase, data);
}

export async function getBankTransferTopupsForAdmin(
  options?: ListTopupsOptions
): Promise<TopupRowWithReceiptUrl[]> {
  const query = topupHistoryQuerySchema.safeParse({
    limit: options?.limit ?? 50
  });

  if (!query.success) {
    throw new Error("Parametros de consulta invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await listTopupsForAdmin(supabase, {
    provider: "bank_transfer",
    limit: query.data.limit
  });

  if (error) {
    throw new Error(normalizeTopupError(error, "No se pudo cargar las recargas de transferencia."));
  }

  return attachReceiptUrls(supabase, data);
}

export async function createPayphoneTopupForUser(
  input: CreatePayphoneTopupInput
): Promise<TopupRow> {
  const parsed = createPayphoneTopupSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de recarga invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesion invalida. Inicia sesion nuevamente.");
  }

  const { data, error } = await createPayphoneTopup(supabase, {
    amount: parsed.data.amount,
    clientReference: parsed.data.clientReference,
    payload: {
      channel: "web",
      initiated_by: user.id
    }
  });

  if (error || !data) {
    throw new Error(normalizeTopupError(error, "No se pudo crear la recarga PayPhone."));
  }

  return data;
}

type CreateBankTransferInput = {
  amount: number;
  clientReference?: string;
  reason?: string;
};

type CreateBankTransferResult = {
  topup: TopupRow;
  verificationCode: string;
};

export async function createBankTransferTopupForUser(
  input: CreateBankTransferInput
): Promise<CreateBankTransferResult> {
  const parsed = createPayphoneTopupSchema.safeParse({
    amount: input.amount,
    clientReference: input.clientReference
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de recarga invalidos.");
  }
  const reason = sanitizeTopupReason(input.reason);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesion invalida. Inicia sesion nuevamente.");
  }

  const verificationCode = createVerificationCode("REC");
  const userTransferReference = parsed.data.clientReference ?? null;

  const { data, error } = await createBankTransferTopup(supabase, {
    amount: parsed.data.amount,
    clientReference: verificationCode,
    receiptPath: null,
    payload: {
      channel: "web",
      initiated_by: user.id,
      verification_code: verificationCode,
      user_transfer_reference: userTransferReference,
      user_reason: reason
    }
  });

  if (error || !data) {
    throw new Error(normalizeTopupError(error, "No se pudo crear la solicitud de transferencia."));
  }

  return {
    topup: data,
    verificationCode
  };
}

export async function reviewBankTransferTopupByAdmin(
  input: ReviewBankTransferTopupInput
): Promise<TopupRow> {
  const parsed = adminTopupReviewSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos de revision invalidos.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await reviewBankTransferTopup(supabase, {
    topupId: parsed.data.topupId,
    decision: parsed.data.decision,
    rejectionReason: parsed.data.rejectionReason,
    payload: input.payload
  });

  if (error || !data) {
    throw new Error(normalizeTopupError(error, "No se pudo revisar la recarga."));
  }

  return data;
}

type ApplyPayphoneResultOptions = {
  client?: SupabaseClient<Database>;
};

export async function applyPayphoneResultToTopup(
  input: ApplyPayphoneResultInput,
  options?: ApplyPayphoneResultOptions
): Promise<TopupRow> {
  const parsed = payphoneWebhookResultSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload de PayPhone invalido.");
  }

  const supabase = options?.client ?? (await createServerSupabaseClient());
  const { data, error } = await applyPayphoneResult(supabase, {
    topupId: parsed.data.topupId,
    approved: parsed.data.approved,
    providerReference: parsed.data.providerReference,
    rejectionReason: parsed.data.rejectionReason,
    payload: parsed.data.payload
  });

  if (error || !data) {
    throw new Error(
      normalizeTopupError(error, "No se pudo procesar el resultado de PayPhone.")
    );
  }

  return data;
}
