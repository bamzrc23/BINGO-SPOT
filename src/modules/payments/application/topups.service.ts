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
  deleteReceiptByPath,
  listTopupsByUserId,
  listTopupsForAdmin,
  reviewBankTransferTopup,
  uploadTopupReceipt
} from "@/modules/payments/infrastructure";
import type { Database } from "@/types/database";

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf"
]);

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

function assertReceiptFile(file: File) {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Debes adjuntar un comprobante valido.");
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    throw new Error("El comprobante excede el limite de 5MB.");
  }

  if (!ALLOWED_RECEIPT_MIME_TYPES.has(file.type)) {
    throw new Error("El comprobante debe ser JPG, PNG o PDF.");
  }
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
  receiptFile: File;
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

  assertReceiptFile(input.receiptFile);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesion invalida. Inicia sesion nuevamente.");
  }

  const verificationCode = createVerificationCode("REC");
  const userTransferReference = parsed.data.clientReference ?? null;

  const uploadResult = await uploadTopupReceipt(supabase, user.id, input.receiptFile);
  if (uploadResult.error || !uploadResult.data) {
    throw new Error(
      normalizeTopupError(uploadResult.error, "No se pudo subir el comprobante.")
    );
  }

  const { data, error } = await createBankTransferTopup(supabase, {
    amount: parsed.data.amount,
    clientReference: verificationCode,
    receiptPath: uploadResult.data,
    payload: {
      channel: "web",
      initiated_by: user.id,
      verification_code: verificationCode,
      user_transfer_reference: userTransferReference
    }
  });

  if (error || !data) {
    await deleteReceiptByPath(supabase, uploadResult.data);
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
