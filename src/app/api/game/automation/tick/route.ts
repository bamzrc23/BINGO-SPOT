import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/modules/auth/infrastructure";

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  return origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        {
          success: false,
          error: "Origen no permitido."
        },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED"
        },
        { status: 401 }
      );
    }

    const profile = await ensureProfileForUser(supabase, user);
    if (!profile || profile.account_status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "ACCOUNT_NOT_ACTIVE"
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc("run_game_round_automation_safe", {
      p_metadata: {
        source: "api.game.automation.tick"
      }
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      state: data
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo ejecutar la automatizacion.";

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
