import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ROUTES } from "@/lib/constants/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { buildWhatsAppUrl } from "@/lib/utils";
import { createBankTransferTopupForUser } from "@/modules/payments/application/topups.service";
import {
  AUTHORIZED_TOPUP_BANK_ACCOUNTS,
  TOPUP_ACCREDITATION_WINDOW_TEXT,
  TOPUP_ACCOUNT_HOLDER,
  type TopupFormState
} from "@/modules/payments/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function normalizeProfileDisplayName(profile: {
  nickname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
} | null): string {
  const nickname = profile?.nickname?.trim();
  if (nickname) {
    return nickname;
  }

  const fullName = `${profile?.first_name?.trim() ?? ""} ${profile?.last_name?.trim() ?? ""}`.trim();
  if (fullName) {
    return fullName;
  }

  const email = profile?.email?.trim();
  if (email) {
    return email;
  }

  return "Usuario";
}

async function resolveTopupUserDisplayName(userId: string): Promise<string> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("nickname, first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle();

    return normalizeProfileDisplayName(data);
  } catch {
    return "Usuario";
  }
}

function buildTopupWhatsAppMessage(args: {
  verificationCode: string;
  amount: number;
  userDisplayName: string;
  reason?: string;
  userReference?: string;
}): string {
  const bankLines = AUTHORIZED_TOPUP_BANK_ACCOUNTS.map(
    (account) => `${account.bankName} (${account.accountType}) - ${account.accountNumber}`
  );

  const lines = [
    "Hola, solicito validar una recarga por transferencia.",
    `Codigo de pedido: ${args.verificationCode}`,
    `Monto a depositar: USD ${args.amount.toFixed(2)}`,
    `Usuario: ${args.userDisplayName}`,
    "",
    "Cuentas autorizadas:",
    ...bankLines,
    `Titular: ${TOPUP_ACCOUNT_HOLDER.fullName}`,
    `${TOPUP_ACCOUNT_HOLDER.documentLabel}: ${TOPUP_ACCOUNT_HOLDER.documentNumber}`
  ];

  if (args.reason) {
    lines.push(`Motivo: ${args.reason}`);
  }

  if (args.userReference) {
    lines.push(`Referencia del cliente: ${args.userReference}`);
  }

  lines.push(`Tiempo estimado de acreditacion: ${TOPUP_ACCREDITATION_WINDOW_TEXT}.`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const amountRaw = parseStringField(formData, "amount");
    const clientReference = parseStringField(formData, "clientReference");
    const reason = parseStringField(formData, "reason");

    if (!reason) {
      return NextResponse.json(
        buildErrorState("Debes indicar el motivo de la recarga.", {
          reason: ["El motivo es obligatorio."]
        }),
        { status: 400 }
      );
    }

    if (!env.ADMIN_WHATSAPP_NUMBER) {
      return NextResponse.json(
        buildErrorState(
          "Falta configurar ADMIN_WHATSAPP_NUMBER en el servidor para enviar la solicitud por WhatsApp."
        ),
        { status: 500 }
      );
    }

    const { topup, verificationCode } = await createBankTransferTopupForUser({
      amount: Number(amountRaw),
      clientReference: clientReference || undefined,
      reason
    });
    const userDisplayName = await resolveTopupUserDisplayName(topup.userId);

    const whatsappMessage = buildTopupWhatsAppMessage({
      verificationCode,
      amount: topup.amount,
      userDisplayName,
      reason,
      userReference: clientReference || undefined
    });
    const redirectUrl = buildWhatsAppUrl(env.ADMIN_WHATSAPP_NUMBER, whatsappMessage);

    revalidatePath(ROUTES.topups);
    revalidatePath(ROUTES.wallet);
    revalidatePath(ROUTES.adminTopups);

    return NextResponse.json(
      buildSuccessState(
        `Solicitud creada con codigo ${verificationCode}. Redirigiendo a WhatsApp para enviarla al administrador.`,
        {
          verificationCode,
          redirectUrl
        }
      ),
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la solicitud de transferencia.";

    return NextResponse.json(buildErrorState(message), { status: 500 });
  }
}
