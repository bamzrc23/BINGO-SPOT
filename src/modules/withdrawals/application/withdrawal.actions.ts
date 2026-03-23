"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import {
  createWithdrawalRequestForUser,
  markWithdrawalAsPaidByAdmin,
  reviewWithdrawalByAdmin
} from "@/modules/withdrawals/application/withdrawal.service";
import {
  INITIAL_WITHDRAWAL_FORM_STATE,
  type WithdrawalFormState
} from "@/modules/withdrawals/domain";

function buildErrorState(message: string, fieldErrors?: Record<string, string[] | undefined>) {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies WithdrawalFormState;
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
  } satisfies WithdrawalFormState;
}

function parseStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createWithdrawalRequestAction(
  _previousState: WithdrawalFormState = INITIAL_WITHDRAWAL_FORM_STATE,
  formData: FormData
): Promise<WithdrawalFormState> {
  try {
    const bankName = parseStringField(formData, "bankName");
    const accountType = parseStringField(formData, "accountType");
    const accountNumber = parseStringField(formData, "accountNumber");
    const accountHolderName = parseStringField(formData, "accountHolderName");
    const accountHolderId = parseStringField(formData, "accountHolderId");
    const amountRequested = parseStringField(formData, "amountRequested");

    if (accountType !== "savings" && accountType !== "checking") {
      return buildErrorState("Tipo de cuenta invalido.", {
        accountType: ["Selecciona ahorros o corriente."]
      });
    }

    const { verificationCode } = await createWithdrawalRequestForUser({
      bankName,
      accountType,
      accountNumber,
      accountHolderName,
      accountHolderId,
      amountRequested: Number(amountRequested)
    });

    revalidatePath(ROUTES.withdrawals);
    revalidatePath(ROUTES.wallet);
    revalidatePath(ROUTES.adminWithdrawals);

    return buildSuccessState(
      `Solicitud de retiro creada con codigo ${verificationCode}. Se envio a revision administrativa.`,
      {
        verificationCode
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la solicitud de retiro.";
    return buildErrorState(message);
  }
}

export async function reviewWithdrawalAction(
  _previousState: WithdrawalFormState = INITIAL_WITHDRAWAL_FORM_STATE,
  formData: FormData
): Promise<WithdrawalFormState> {
  try {
    const withdrawalId = parseStringField(formData, "withdrawalId");
    const decision = parseStringField(formData, "decision");
    const observation = parseStringField(formData, "observation");
    const rejectionReason = parseStringField(formData, "rejectionReason");

    if (decision !== "approved" && decision !== "rejected") {
      return buildErrorState("Decision invalida.");
    }

    await reviewWithdrawalByAdmin({
      withdrawalId,
      decision,
      observation: observation || undefined,
      rejectionReason: rejectionReason || undefined
    });

    revalidatePath(ROUTES.adminWithdrawals);
    revalidatePath(ROUTES.withdrawals);
    revalidatePath(ROUTES.wallet);

    return buildSuccessState(
      decision === "approved" ? "Retiro aprobado." : "Retiro rechazado y saldo liberado."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo revisar el retiro.";
    return buildErrorState(message);
  }
}

export async function markWithdrawalPaidAction(
  _previousState: WithdrawalFormState = INITIAL_WITHDRAWAL_FORM_STATE,
  formData: FormData
): Promise<WithdrawalFormState> {
  try {
    const withdrawalId = parseStringField(formData, "withdrawalId");
    const observation = parseStringField(formData, "observation");
    const externalReference = parseStringField(formData, "externalReference");

    await markWithdrawalAsPaidByAdmin({
      withdrawalId,
      observation: observation || undefined,
      externalReference: externalReference || undefined
    });

    revalidatePath(ROUTES.adminWithdrawals);
    revalidatePath(ROUTES.withdrawals);
    revalidatePath(ROUTES.wallet);

    return buildSuccessState("Retiro marcado como pagado y debitado de la billetera.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo marcar el retiro como pagado.";
    return buildErrorState(message);
  }
}
