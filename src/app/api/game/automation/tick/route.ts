import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ensureProfileForUser } from "@/modules/auth/infrastructure";
import {
  GAME_DEFAULT_BASE_LINE_PRIZE,
  GAME_ROOM_DRAW_INTERVAL_SECONDS,
  GAME_ROOM_PRESTART_ANIMATION_SECONDS,
  GAME_ROOM_ROUND_COOLDOWN_SECONDS,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P1,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P2,
  GAME_ROUND_DEFAULT_EXTRA_SPINS_P3,
  GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY
} from "@/modules/game/domain";

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

    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient.rpc("run_game_round_automation", {
      p_draw_interval_seconds: GAME_ROOM_DRAW_INTERVAL_SECONDS,
      p_prestart_animation_seconds: GAME_ROOM_PRESTART_ANIMATION_SECONDS,
      p_round_cooldown_seconds: GAME_ROOM_ROUND_COOLDOWN_SECONDS,
      p_base_prize: GAME_DEFAULT_BASE_LINE_PRIZE,
      p_lucky_ball_probability: GAME_ROUND_DEFAULT_LUCKY_BALL_PROBABILITY,
      p_extra_spins_p1: GAME_ROUND_DEFAULT_EXTRA_SPINS_P1,
      p_extra_spins_p2: GAME_ROUND_DEFAULT_EXTRA_SPINS_P2,
      p_extra_spins_p3: GAME_ROUND_DEFAULT_EXTRA_SPINS_P3
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
