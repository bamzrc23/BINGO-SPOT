"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import { env } from "@/lib/env";
import { buildWhatsAppUrl } from "@/lib/utils";
import {
  createBankTransferTopupForUser,
  reviewBankTransferTopupByAdmin
} from "@/modules/payments/application/topups.service";
import { INITIAL_TOPUP_FORM_STATE, type TopupFormState } from "@/modules/payments/domain";

function buildErrorState(message: string, fieldErrors?: Record<string, string[] | undefined>) {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies TopupFormState;
}

function buildSuccessState(message: string, options?: {
  verificationCode?: string;
  redirectUrl?: string;
}) {
  return {
    status: "success",
    message,
    verificationCode: options?.verificationCode,
    redirectUrl: options?.redirectUrl
  } satisfies TopupFormState;
}

function parseStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildTopupWhatsAppMessage(args: {
  verificationCode: string;
  amount: number;
  topupId: string;
  userId: string;
  userReference?: string;
}): string {
  const lines = [
    "Hola, solicito validar una recarga por transferencia.",
    `Codigo: ${args.verificationCode}`,
    `Monto: USD ${args.amount.toFixed(2)}`,
    `Solicitud: ${args.topupId}`,
    `Usuario: ${args.userId}`
  ];

  if (args.userReference) {
    lines.push(`Referencia del cliente: ${args.userReference}`);
  }

  lines.push("Comprobante cargado en la plataforma. Gracias.");
  return lines.join("\n");
}

export async function createPayphoneTopupAction(
  _previousState: TopupFormState = INITIAL_TOPUP_FORM_STATE,
  _formData: FormData
): Promise<TopupFormState> {
  return buildErrorState(
    "PayPhone esta deshabilitado. Usa recarga por transferencia y continua por WhatsApp."
  );
}

export async function createBankTransferTopupAction(
  _previousState: TopupFormState = INITIAL_TOPUP_FORM_STATE,
  formData: FormData
): Promise<TopupFormState> {
  try {
    const amountRaw = parseStringField(formData, "amount");
    const clientReference = parseStringField(formData, "clientReference");
    const receiptFile = formData.get("receiptFile");

    if (!(receiptFile instanceof File)) {
      return buildErrorState("Debes adjuntar un comprobante.", {
        receiptFile: ["Selecciona un archivo JPG, PNG o PDF."]
      });
    }

    if (!env.ADMIN_WHATSAPP_NUMBER) {
      return buildErrorState(
        "Falta configurar ADMIN_WHATSAPP_NUMBER en el servidor para enviar la solicitud por WhatsApp."
      );
    }

    const { topup, verificationCode } = await createBankTransferTopupForUser({
      amount: Number(amountRaw),
      clientReference: clientReference || undefined,
      receiptFile
    });

    const whatsappMessage = buildTopupWhatsAppMessage({
      verificationCode,
      amount: topup.amount,
      topupId: topup.id,
      userId: topup.userId,
      userReference: clientReference || undefined
    });
    const redirectUrl = buildWhatsAppUrl(env.ADMIN_WHATSAPP_NUMBER, whatsappMessage);

    revalidatePath(ROUTES.topups);
    revalidatePath(ROUTES.wallet);
    revalidatePath(ROUTES.adminTopups);

    return buildSuccessState(
      `Solicitud creada con codigo ${verificationCode}. Redirigiendo a WhatsApp para enviarla al administrador.`,
      {
        verificationCode,
        redirectUrl
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la solicitud de transferencia.";
    return buildErrorState(message);
  }
}

export async function reviewBankTransferTopupAction(
  _previousState: TopupFormState = INITIAL_TOPUP_FORM_STATE,
  formData: FormData
): Promise<TopupFormState> {
  try {
    const topupId = parseStringField(formData, "topupId");
    const decision = parseStringField(formData, "decision");
    const rejectionReason = parseStringField(formData, "rejectionReason");

    if (decision !== "approved" && decision !== "rejected") {
      return buildErrorState("Decision invalida.");
    }

    await reviewBankTransferTopupByAdmin({
      topupId,
      decision,
      rejectionReason: rejectionReason || undefined
    });

    revalidatePath(ROUTES.adminTopups);
    revalidatePath(ROUTES.topups);
    revalidatePath(ROUTES.wallet);

    return buildSuccessState(
      decision === "approved"
        ? "Recarga aprobada y saldo acreditado."
        : "Recarga rechazada correctamente."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo revisar la recarga.";
    return buildErrorState(message);
  }
}
