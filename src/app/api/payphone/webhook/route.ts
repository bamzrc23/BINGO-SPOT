import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { applyPayphoneResultToTopup } from "@/modules/payments/application/topups.service";

type PayphoneWebhookBody = {
  topupId?: string;
  approved?: boolean;
  providerReference?: string;
  rejectionReason?: string;
  payload?: Record<string, unknown>;
};

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    if (env.PAYPHONE_WEBHOOK_TOKEN) {
      const incomingToken = request.headers.get("x-payphone-token");
      if (!incomingToken || incomingToken !== env.PAYPHONE_WEBHOOK_TOKEN) {
        return unauthorizedResponse();
      }
    }

    const body = (await request.json()) as PayphoneWebhookBody;

    const topupId = typeof body.topupId === "string" ? body.topupId : "";
    const approved = body.approved === true;
    const providerReference =
      typeof body.providerReference === "string" ? body.providerReference : undefined;
    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason : undefined;
    const payload = typeof body.payload === "object" && body.payload ? body.payload : {};

    const adminClient = createAdminSupabaseClient();
    const topup = await applyPayphoneResultToTopup(
      {
        topupId,
        approved,
        providerReference,
        rejectionReason,
        payload
      },
      {
        client: adminClient
      }
    );

    return NextResponse.json({
      success: true,
      topupId: topup.id,
      status: topup.status,
      walletTransactionId: topup.walletTransactionId
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo procesar webhook de PayPhone.";

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 400 }
    );
  }
}
